import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Wallet } from 'lucide-react';

export default function Login() {
  const { user, loading, signInWithGoogle } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) {
      navigate('/');
    }
  }, [user, loading, navigate]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Carregando...</div>;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50 dark:bg-neutral-950 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto bg-primary/10 p-4 rounded-full w-16 h-16 flex items-center justify-center mb-4">
            <Wallet className="w-8 h-8 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold">MooreFinance</CardTitle>
          <CardDescription>
            Gerencie suas finanças de forma inteligente com MooreFinance.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button 
            className="w-full h-12 text-lg font-medium" 
            onClick={signInWithGoogle}
          >
            Entrar com Google
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
