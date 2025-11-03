import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { UtensilsCrossed } from "lucide-react";

const Auth = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [studentNumber, setStudentNumber] = useState("");
  const [studentPassword, setStudentPassword] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerPassword, setOwnerPassword] = useState("");
  const [ownerName, setOwnerName] = useState("");

  const handleStudentSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const email = `${studentNumber}@student.akgec.ac.in`;
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email,
        password: studentPassword,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: {
            student_number: studentNumber
          }
        }
      });

      if (signUpError) throw signUpError;

      if (authData.user) {
        const { error: profileError } = await supabase
          .from('profiles')
          .insert({
            user_id: authData.user.id,
            role: 'student',
            student_number: studentNumber
          });

        if (profileError) throw profileError;
      }

      toast.success("Account created! You can now sign in.");
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleStudentSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const email = `${studentNumber}@student.akgec.ac.in`;
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password: studentPassword,
      });

      if (error) throw error;
      toast.success("Welcome back!");
      navigate("/");
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOwnerSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (!ownerEmail.endsWith('@akgec.ac.in')) {
        throw new Error('Owners must use @akgec.ac.in email address');
      }

      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: ownerEmail,
        password: ownerPassword,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: {
            full_name: ownerName
          }
        }
      });

      if (signUpError) throw signUpError;

      if (authData.user) {
        const { error: profileError } = await supabase
          .from('profiles')
          .insert({
            user_id: authData.user.id,
            role: 'owner',
            full_name: ownerName
          });

        if (profileError) throw profileError;
      }

      toast.success("Account created! You can now sign in.");
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOwnerSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (!ownerEmail.endsWith('@akgec.ac.in')) {
        throw new Error('Owners must use @akgec.ac.in email address');
      }

      const { error } = await supabase.auth.signInWithPassword({
        email: ownerEmail,
        password: ownerPassword,
      });

      if (error) throw error;
      toast.success("Welcome back!");
      navigate("/");
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-8">
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-primary-glow flex items-center justify-center">
            <UtensilsCrossed className="w-6 h-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">AKGEC Canteen</h1>
          </div>
        </div>

        <Tabs defaultValue="student-signin" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="student-signin">Student</TabsTrigger>
            <TabsTrigger value="owner-signin">Owner</TabsTrigger>
          </TabsList>

          <TabsContent value="student-signin">
            <Tabs defaultValue="signin" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin">Sign In</TabsTrigger>
                <TabsTrigger value="signup">Sign Up</TabsTrigger>
              </TabsList>

              <TabsContent value="signin">
                <form onSubmit={handleStudentSignIn} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="student-number-signin">Student Number</Label>
                    <Input
                      id="student-number-signin"
                      type="text"
                      placeholder="2101330100xyz"
                      value={studentNumber}
                      onChange={(e) => setStudentNumber(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="student-password-signin">Password</Label>
                    <Input
                      id="student-password-signin"
                      type="password"
                      placeholder="••••••••"
                      value={studentPassword}
                      onChange={(e) => setStudentPassword(e.target.value)}
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "Signing in..." : "Sign In"}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup">
                <form onSubmit={handleStudentSignUp} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="student-number-signup">Student Number</Label>
                    <Input
                      id="student-number-signup"
                      type="text"
                      placeholder="2101330100xyz"
                      value={studentNumber}
                      onChange={(e) => setStudentNumber(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="student-password-signup">Password</Label>
                    <Input
                      id="student-password-signup"
                      type="password"
                      placeholder="••••••••"
                      value={studentPassword}
                      onChange={(e) => setStudentPassword(e.target.value)}
                      required
                      minLength={6}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "Creating account..." : "Sign Up"}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </TabsContent>

          <TabsContent value="owner-signin">
            <Tabs defaultValue="signin" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin">Sign In</TabsTrigger>
                <TabsTrigger value="signup">Sign Up</TabsTrigger>
              </TabsList>

              <TabsContent value="signin">
                <form onSubmit={handleOwnerSignIn} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="owner-email-signin">College Email</Label>
                    <Input
                      id="owner-email-signin"
                      type="email"
                      placeholder="name@akgec.ac.in"
                      value={ownerEmail}
                      onChange={(e) => setOwnerEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="owner-password-signin">Password</Label>
                    <Input
                      id="owner-password-signin"
                      type="password"
                      placeholder="••••••••"
                      value={ownerPassword}
                      onChange={(e) => setOwnerPassword(e.target.value)}
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "Signing in..." : "Sign In"}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup">
                <form onSubmit={handleOwnerSignUp} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="owner-name">Full Name</Label>
                    <Input
                      id="owner-name"
                      type="text"
                      placeholder="John Doe"
                      value={ownerName}
                      onChange={(e) => setOwnerName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="owner-email-signup">College Email</Label>
                    <Input
                      id="owner-email-signup"
                      type="email"
                      placeholder="name@akgec.ac.in"
                      value={ownerEmail}
                      onChange={(e) => setOwnerEmail(e.target.value)}
                      required
                    />
                    <p className="text-xs text-muted-foreground">Must use @akgec.ac.in domain</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="owner-password-signup">Password</Label>
                    <Input
                      id="owner-password-signup"
                      type="password"
                      placeholder="••••••••"
                      value={ownerPassword}
                      onChange={(e) => setOwnerPassword(e.target.value)}
                      required
                      minLength={6}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "Creating account..." : "Sign Up"}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  );
};

export default Auth;
