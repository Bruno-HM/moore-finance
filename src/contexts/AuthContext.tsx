import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { doc, getDoc, onSnapshot, collection, query, where, getDocs, writeBatch } from 'firebase/firestore';
import { auth, db, googleProvider } from '../lib/firebase';
import { safeSetDoc } from '../lib/firestore-utils';
import { v4 as uuidv4 } from 'uuid';
import { handleFirestoreError, OperationType } from '../lib/error-handler';

interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  householdId: string | null;
  personalHouseholdId: string | null;
  inviteCode?: string | null;
  creditCardClosingDay?: number;
  salary?: number;
  tutorialCompleted?: boolean;
}

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  householdMembers: UserProfile[];
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  joinHousehold: (inviteCode: string) => Promise<void>;
  leaveHousehold: () => Promise<void>;
  repairHousehold: () => Promise<void>;
  updateProfile: (data: Partial<UserProfile>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [householdMembers, setHouseholdMembers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribeProfile: (() => void) | undefined;
    let unsubscribeHousehold: (() => void) | undefined;
    let unsubscribeMembers: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      console.log('Auth state changed:', firebaseUser?.uid);
      setUser(firebaseUser);
      if (firebaseUser) {
        // Listen to user profile changes
        const userRef = doc(db, 'users', firebaseUser.uid);
        let currentHouseholdId: string | null = null;

        unsubscribeProfile = onSnapshot(userRef, async (docSnap) => {
          if (docSnap.exists()) {
            const userData = docSnap.data() as UserProfile;
            
            // Auto-create personal household if missing
            if (!userData.personalHouseholdId) {
              const personalId = uuidv4();
              const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();
              
              try {
                await safeSetDoc(doc(db, 'households', personalId), {
                  id: personalId,
                  inviteCode,
                  members: [firebaseUser.uid],
                  isPersonal: true,
                  ownerId: firebaseUser.uid,
                  createdAt: new Date().toISOString(),
                });
                
                await safeSetDoc(doc(db, 'invite_codes', inviteCode), { 
                  householdId: personalId 
                });
                
                await safeSetDoc(userRef, { 
                  personalHouseholdId: personalId,
                  householdId: userData.householdId || personalId,
                  tutorialCompleted: userData.tutorialCompleted ?? false
                }, { merge: true });
                return; // Snapshot will trigger again
              } catch (err) {
                console.error('Error creating personal household:', err);
              }
            }

            // If householdId changed or we don't have a listener yet
            if (userData.householdId !== currentHouseholdId) {
              if (unsubscribeHousehold) {
                unsubscribeHousehold();
                unsubscribeHousehold = undefined;
              }
              if (unsubscribeMembers) {
                unsubscribeMembers();
                unsubscribeMembers = undefined;
              }
              currentHouseholdId = userData.householdId;

              if (currentHouseholdId) {
                // Listen to household data
                unsubscribeHousehold = onSnapshot(doc(db, 'households', currentHouseholdId), async (hSnap) => {
                  if (hSnap.exists()) {
                    const hData = hSnap.data();
                    let inviteCode = hData.inviteCode;

                    if (!inviteCode) {
                      inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();
                      try {
                        await safeSetDoc(doc(db, 'households', currentHouseholdId!), { inviteCode }, { merge: true });
                      } catch (err) {
                        console.error('Error auto-repairing invite code:', err);
                      }
                    }

                    // Auto-migration: Ensure the secure invite index exists for the current code
                    if (inviteCode) {
                      safeSetDoc(doc(db, 'invite_codes', inviteCode), { 
                        householdId: currentHouseholdId! 
                      }, { merge: true }).catch(err => {
                        console.error('Error syncing invite index:', err);
                      });
                    }

                    setUserProfile({ ...userData, inviteCode });
                  } else {
                    // Household document missing but we have an ID? 
                    // DON'T fallback automatically to personal anymore, 
                    // as it overwrites the shared link in the DB.
                    setUserProfile(userData);
                  }
                });

                // Listen to household members
                const qMembers = query(collection(db, 'users'), where('householdId', '==', currentHouseholdId));
                unsubscribeMembers = onSnapshot(qMembers, (mSnap) => {
                  const members = mSnap.docs.map(d => d.data() as UserProfile);
                  setHouseholdMembers(members);
                });
              } else {
                setUserProfile(userData);
                setHouseholdMembers([userData]);
              }
            } else if (!currentHouseholdId) {
              setUserProfile(userData);
              setHouseholdMembers([userData]);
            }
          } else {
            // Create user profile if it doesn't exist
            const personalId = uuidv4();
            const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();
            
            const newProfile: UserProfile = {
              uid: firebaseUser.uid,
              email: firebaseUser.email || '',
              displayName: firebaseUser.displayName || '',
              photoURL: firebaseUser.photoURL || '',
              personalHouseholdId: personalId,
              householdId: personalId,
            };

            try {
              // Create household first
              await safeSetDoc(doc(db, 'households', personalId), {
                id: personalId,
                inviteCode,
                members: [firebaseUser.uid],
                isPersonal: true,
                ownerId: firebaseUser.uid,
                createdAt: new Date().toISOString(),
              });

              await safeSetDoc(doc(db, 'invite_codes', inviteCode), { 
                householdId: personalId 
              });

              // Then create profile
              await safeSetDoc(userRef, newProfile);
            } catch (err) {
              console.error('Error initializing user:', err);
              handleFirestoreError(err, OperationType.WRITE, `users/${firebaseUser.uid}`, firebaseUser);
            }
          }
          setLoading(false);
        }, (error) => {
          console.error('Profile snapshot error:', error);
          handleFirestoreError(error, OperationType.GET, `users/${firebaseUser.uid}`, firebaseUser);
          setLoading(false);
        });
      } else {
        if (unsubscribeProfile) unsubscribeProfile();
        if (unsubscribeHousehold) unsubscribeHousehold();
        if (unsubscribeMembers) unsubscribeMembers();
        setUserProfile(null);
        setHouseholdMembers([]);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
      if (unsubscribeHousehold) unsubscribeHousehold();
      if (unsubscribeMembers) unsubscribeMembers();
    };
  }, []);

  const signInWithGoogle = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error('Error signing in with Google', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Error signing out', error);
      throw error;
    }
  };

  const joinHousehold = async (inviteCode: string) => {
    if (!user || !userProfile) return;
    const normalizedCode = inviteCode.trim().toUpperCase();
    
    try {
      const inviteRef = doc(db, 'invite_codes', normalizedCode);
      const inviteSnap = await getDoc(inviteRef);
      if (!inviteSnap.exists()) throw new Error('Código de convite inválido.');
      
      const { householdId } = inviteSnap.data();
      const hRef = doc(db, 'households', householdId);
      const hSnap = await getDoc(hRef);
      if (!hSnap.exists()) throw new Error('Erro ao localizar os dados do grupo.');
      
      const data = hSnap.data();
      if (data.members.length >= 2) throw new Error('Esta conta já atingiu o limite de 2 membros.');
      if (data.members.includes(user.uid)) throw new Error('Você já é um membro desta conta.');

      const batch = writeBatch(db);
      
      // Archiving/Reactivation logic
      let archivedMembers = data.archivedMembers || [];
      const wasArchived = archivedMembers.includes(user.uid);
      
      if (wasArchived) {
        archivedMembers = archivedMembers.filter((id: string) => id !== user.uid);
        
        // Reactivate assets
        const [accSnap, cardSnap] = await Promise.all([
          getDocs(query(collection(db, 'bank_accounts'), where('householdId', '==', householdId), where('memberId', '==', user.uid))),
          getDocs(query(collection(db, 'credit_cards'), where('householdId', '==', householdId), where('memberId', '==', user.uid)))
        ]);
        
        accSnap.docs.forEach(d => batch.update(d.ref, { isActive: true }));
        cardSnap.docs.forEach(d => batch.update(d.ref, { isActive: true }));
      }

      batch.update(hRef, { 
        members: [...data.members, user.uid],
        archivedMembers,
        inviteCode: data.inviteCode 
      });
      
      batch.update(doc(db, 'users', user.uid), { householdId });
      
      await batch.commit();
    } catch (error) {
      if (error instanceof Error && (error.message.includes('inválido') || error.message.includes('limite') || error.message.includes('membro') || error.message.includes('Erro ao localizar'))) {
        throw error;
      }
      handleFirestoreError(error, OperationType.WRITE, `invite_codes/${normalizedCode}`);
    }
  };

  const leaveHousehold = async () => {
    if (!user || !userProfile?.householdId || !userProfile.personalHouseholdId) return;
    if (userProfile.householdId === userProfile.personalHouseholdId) return;

    const currentHouseholdId = userProfile.householdId;
    const hRef = doc(db, 'households', currentHouseholdId);
    
    try {
      const hSnap = await getDoc(hRef);
      if (!hSnap.exists()) return;
      const data = hSnap.data();

      const batch = writeBatch(db);
      
      // Update Household Membership
      const newMembers = data.members.filter((m: string) => m !== user.uid);
      let archivedMembers = data.archivedMembers || [];
      
      // Add to archive (max 3 items FIFO)
      if (!archivedMembers.includes(user.uid)) {
        archivedMembers.push(user.uid);
        if (archivedMembers.length > 3) archivedMembers.shift();
      }

      batch.update(hRef, { 
        members: newMembers,
        archivedMembers 
      });

      // Update User Profile
      batch.update(doc(db, 'users', user.uid), { householdId: userProfile.personalHouseholdId });

      // Deactivate assets
      const [accSnap, cardSnap] = await Promise.all([
        getDocs(query(collection(db, 'bank_accounts'), where('householdId', '==', currentHouseholdId), where('memberId', '==', user.uid))),
        getDocs(query(collection(db, 'credit_cards'), where('householdId', '==', currentHouseholdId), where('memberId', '==', user.uid)))
      ]);

      accSnap.docs.forEach(d => batch.update(d.ref, { isActive: false }));
      cardSnap.docs.forEach(d => batch.update(d.ref, { isActive: false }));

      await batch.commit();
    } catch (error) {
      console.error('Error leaving household:', error);
      handleFirestoreError(error, OperationType.WRITE, `households/leave`);
    }
  };

  const repairHousehold = async () => {
    if (!user || !userProfile?.householdId) return;
    const householdId = userProfile.householdId;
    
    try {
      // 1. Get current household data to find invite code
      const hSnap = await getDoc(doc(db, 'households', householdId));
      if (!hSnap.exists()) return;
      const hData = hSnap.data();
      
      // 2. Find all users that have this householdId
      const q = query(collection(db, 'users'), where('householdId', '==', householdId));
      const uSnap = await getDocs(q);
      const memberUids = uSnap.docs.map(d => d.id);
      
      if (memberUids.length > 0) {
        // 3. Update the household document with the correct member list
        await safeSetDoc(doc(db, 'households', householdId), {
          members: memberUids,
          id: householdId 
        }, { merge: true });

        // 4. Update the invite search index
        if (hData.inviteCode) {
          await safeSetDoc(doc(db, 'invite_codes', hData.inviteCode), {
            householdId: householdId
          });
        }
        
        console.log(`✅ Repaired household ${householdId} with ${memberUids.length} members and updated index.`);
      }
    } catch (error) {
      console.error('Error repairing household:', error);
      throw error;
    }
  };

  const updateProfile = async (data: Partial<UserProfile>) => {
    if (!user) return;
    const userRef = doc(db, 'users', user.uid);
    try {
      await safeSetDoc(userRef, data, { merge: true });
      
      // Update local state immediately to avoid race conditions with snapshots
      // and prevent issues like the tour re-triggering during navigation.
      setUserProfile(prev => prev ? { ...prev, ...data } : null);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}`);
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, userProfile, householdMembers, loading, 
      signInWithGoogle, logout, joinHousehold, leaveHousehold, 
      repairHousehold, updateProfile 
    }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

