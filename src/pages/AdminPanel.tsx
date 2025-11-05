import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { Navbar } from "@/components/Navbar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Shield, UserPlus, Users, TrendingUp } from "lucide-react";
import { format } from "date-fns";

interface UserRole {
  id: string;
  user_id: string;
  role: string;
  created_at: string;
}

interface Analytics {
  order_date: string;
  total_orders: number;
  total_revenue: number;
  unique_customers: number;
}

const AdminPanel = () => {
  const navigate = useNavigate();
  const { isAdmin, loading: roleLoading } = useUserRole();
  const [user, setUser] = useState<any>(null);
  const [userRoles, setUserRoles] = useState<UserRole[]>([]);
  const [analytics, setAnalytics] = useState<Analytics[]>([]);
  const [loading, setLoading] = useState(true);
  const [newOwnerEmail, setNewOwnerEmail] = useState('');

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!roleLoading && !isAdmin) {
      toast.error("Access denied. Admin role required.");
      navigate('/');
    }
  }, [isAdmin, roleLoading, navigate]);

  useEffect(() => {
    if (isAdmin) {
      fetchUserRoles();
      fetchAnalytics();
    }
  }, [isAdmin]);

  const fetchUserRoles = async () => {
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUserRoles(data || []);
    } catch (error) {
      console.error('Error fetching user roles:', error);
      toast.error("Error loading user roles");
    } finally {
      setLoading(false);
    }
  };

  const fetchAnalytics = async () => {
    try {
      const { data, error } = await supabase
        .from('order_analytics')
        .select('*')
        .limit(30);

      if (error) throw error;
      setAnalytics(data || []);
    } catch (error) {
      console.error('Error fetching analytics:', error);
    }
  };

  const handleApproveOwner = async () => {
    if (!newOwnerEmail.trim()) {
      toast.error("Please enter an email address");
      return;
    }

    try {
      // Get user ID from email via auth admin API (requires service role)
      // For now, we'll need the user to sign up first
      toast.error("User must sign up first. Then you can grant them owner role using their user ID.");
    } catch (error) {
      console.error('Error approving owner:', error);
      toast.error("Failed to approve owner");
    }
  };

  const handleGrantRole = async (userId: string, role: string) => {
    try {
      const { error } = await supabase
        .from('user_roles')
        .insert({ user_id: userId, role });

      if (error) throw error;
      toast.success(`${role} role granted successfully`);
      fetchUserRoles();
    } catch (error) {
      console.error('Error granting role:', error);
      toast.error("Failed to grant role");
    }
  };

  const handleRevokeRole = async (roleId: string) => {
    if (!confirm("Are you sure you want to revoke this role?")) return;

    try {
      const { error } = await supabase
        .from('user_roles')
        .delete()
        .eq('id', roleId);

      if (error) throw error;
      toast.success("Role revoked successfully");
      fetchUserRoles();
    } catch (error) {
      console.error('Error revoking role:', error);
      toast.error("Failed to revoke role");
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast.success("Signed out successfully");
    navigate('/');
  };

  if (roleLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const totalUsers = new Set(userRoles.map(r => r.user_id)).size;
  const totalOwners = userRoles.filter(r => r.role === 'owner').length;
  const totalRevenue = analytics.reduce((sum, day) => sum + parseFloat(String(day.total_revenue)), 0);
  const totalOrders = analytics.reduce((sum, day) => sum + day.total_orders, 0);

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <Navbar user={user} onSignOut={handleSignOut} />
      
      <main className="container mx-auto px-4 pt-24 pb-12">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2 flex items-center gap-2">
            <Shield className="h-8 w-8" />
            Admin Panel
          </h1>
          <p className="text-muted-foreground">System administration and analytics</p>
        </div>

        <div className="grid gap-6 md:grid-cols-4 mb-8">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Users className="h-4 w-4" />
                Total Users
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalUsers}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <UserPlus className="h-4 w-4" />
                Owners
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalOwners}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Total Orders
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalOrders}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">₹{totalRevenue.toFixed(2)}</div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>User Roles Management</CardTitle>
              <CardDescription>View and manage user roles</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-4 flex gap-2">
                <Input
                  placeholder="User ID to grant role"
                  value={newOwnerEmail}
                  onChange={(e) => setNewOwnerEmail(e.target.value)}
                />
                <Button onClick={handleApproveOwner}>
                  Grant Owner
                </Button>
              </div>
              <div className="max-h-[400px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User ID</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Granted</TableHead>
                      <TableHead>Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {userRoles.map((userRole) => (
                      <TableRow key={userRole.id}>
                        <TableCell className="font-mono text-xs">
                          {userRole.user_id.substring(0, 8)}...
                        </TableCell>
                        <TableCell>
                          <Badge variant={userRole.role === 'admin' ? 'destructive' : 'default'}>
                            {userRole.role}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs">
                          {format(new Date(userRole.created_at), 'MMM dd, yyyy')}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRevokeRole(userRole.id)}
                          >
                            Revoke
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>System Analytics</CardTitle>
              <CardDescription>Daily performance metrics (last 30 days)</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="max-h-[400px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Orders</TableHead>
                      <TableHead>Revenue</TableHead>
                      <TableHead>Customers</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {analytics.map((day, index) => (
                      <TableRow key={index}>
                        <TableCell>
                          {format(new Date(day.order_date), 'MMM dd')}
                        </TableCell>
                        <TableCell>{day.total_orders}</TableCell>
                        <TableCell>₹{parseFloat(String(day.total_revenue)).toFixed(2)}</TableCell>
                        <TableCell>{day.unique_customers}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default AdminPanel;
