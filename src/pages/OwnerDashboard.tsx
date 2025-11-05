import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { Navbar } from "@/components/Navbar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, Plus, Pencil, Trash2, Package, ShoppingCart } from "lucide-react";

interface MenuItem {
  id: string;
  name: string;
  description: string | null;
  category: string;
  price: number;
}

interface Order {
  id: string;
  user_id: string;
  item_id: string;
  quantity: number;
  total_price: number;
  ordered_at: string;
  menu_items: MenuItem;
}

const OwnerDashboard = () => {
  const navigate = useNavigate();
  const { isOwner, loading: roleLoading } = useUserRole();
  const [user, setUser] = useState<any>(null);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: 'Snacks',
    price: ''
  });

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
    if (!roleLoading && !isOwner) {
      toast.error("Access denied. Owner role required.");
      navigate('/');
    }
  }, [isOwner, roleLoading, navigate]);

  useEffect(() => {
    if (isOwner) {
      fetchMenuItems();
      fetchOrders();
    }
  }, [isOwner]);

  const fetchMenuItems = async () => {
    try {
      const { data, error } = await supabase
        .from('menu_items')
        .select('*')
        .order('category', { ascending: true });

      if (error) throw error;
      setMenuItems(data || []);
    } catch (error) {
      console.error('Error fetching menu items:', error);
      toast.error("Error loading menu items");
    } finally {
      setLoading(false);
    }
  };

  const fetchOrders = async () => {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*, menu_items(*)')
        .order('ordered_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setOrders(data || []);
    } catch (error) {
      console.error('Error fetching orders:', error);
      toast.error("Error loading orders");
    }
  };

  const handleSaveItem = async () => {
    const price = parseFloat(formData.price);
    
    if (!formData.name || !formData.category || isNaN(price)) {
      toast.error("Please fill all required fields");
      return;
    }

    try {
      if (editingItem) {
        const { error } = await supabase
          .from('menu_items')
          .update({
            name: formData.name,
            description: formData.description,
            category: formData.category,
            price
          })
          .eq('id', editingItem.id);

        if (error) throw error;
        toast.success("Item updated successfully");
      } else {
        const { error } = await supabase
          .from('menu_items')
          .insert({
            name: formData.name,
            description: formData.description,
            category: formData.category,
            price
          });

        if (error) throw error;
        toast.success("Item added successfully");
      }

      setShowDialog(false);
      resetForm();
      fetchMenuItems();
    } catch (error) {
      console.error('Error saving item:', error);
      toast.error("Failed to save item");
    }
  };

  const handleDeleteItem = async (id: string) => {
    if (!confirm("Are you sure you want to delete this item?")) return;

    try {
      const { error } = await supabase
        .from('menu_items')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success("Item deleted successfully");
      fetchMenuItems();
    } catch (error) {
      console.error('Error deleting item:', error);
      toast.error("Failed to delete item");
    }
  };

  const openEditDialog = (item: MenuItem) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      description: item.description || '',
      category: item.category,
      price: item.price.toString()
    });
    setShowDialog(true);
  };

  const openAddDialog = () => {
    resetForm();
    setShowDialog(true);
  };

  const resetForm = () => {
    setEditingItem(null);
    setFormData({
      name: '',
      description: '',
      category: 'Snacks',
      price: ''
    });
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

  const categoryStats = menuItems.reduce((acc, item) => {
    acc[item.category] = (acc[item.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const totalRevenue = orders.reduce((sum, order) => sum + parseFloat(String(order.total_price)), 0);

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <Navbar user={user} onSignOut={handleSignOut} />
      
      <main className="container mx-auto px-4 pt-24 pb-12">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Owner Dashboard</h1>
          <p className="text-muted-foreground">Manage your canteen operations</p>
        </div>

        <Tabs defaultValue="menu" className="space-y-6">
          <TabsList>
            <TabsTrigger value="menu" className="gap-2">
              <Package className="h-4 w-4" />
              Menu Management
            </TabsTrigger>
            <TabsTrigger value="orders" className="gap-2">
              <ShoppingCart className="h-4 w-4" />
              Live Orders
            </TabsTrigger>
          </TabsList>

          <TabsContent value="menu" className="space-y-6">
            <div className="grid gap-4 md:grid-cols-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Total Items</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{menuItems.length}</div>
                </CardContent>
              </Card>
              {Object.entries(categoryStats).slice(0, 3).map(([category, count]) => (
                <Card key={category}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">{category}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{count}</div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Menu Items</CardTitle>
                    <CardDescription>Manage your canteen menu</CardDescription>
                  </div>
                  <Button onClick={openAddDialog} className="gap-2">
                    <Plus className="h-4 w-4" />
                    Add Item
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {menuItems.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.name}</TableCell>
                        <TableCell>{item.category}</TableCell>
                        <TableCell>₹{item.price.toFixed(2)}</TableCell>
                        <TableCell className="max-w-xs truncate">{item.description || '-'}</TableCell>
                        <TableCell className="text-right space-x-2">
                          <Button variant="ghost" size="sm" onClick={() => openEditDialog(item)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDeleteItem(item.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="orders" className="space-y-6">
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{orders.length}</div>
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
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Avg Order Value</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    ₹{orders.length > 0 ? (totalRevenue / orders.length).toFixed(2) : '0.00'}
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Recent Orders</CardTitle>
                <CardDescription>Latest 50 orders from customers</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead>Quantity</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Time</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders.map((order) => (
                      <TableRow key={order.id}>
                        <TableCell className="font-medium">{order.menu_items.name}</TableCell>
                        <TableCell>{order.quantity}</TableCell>
                        <TableCell>₹{parseFloat(String(order.total_price)).toFixed(2)}</TableCell>
                        <TableCell>
                          {new Date(order.ordered_at).toLocaleString('en-IN', {
                            dateStyle: 'short',
                            timeStyle: 'short'
                          })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Edit Menu Item' : 'Add Menu Item'}</DialogTitle>
            <DialogDescription>
              {editingItem ? 'Update the details below' : 'Enter the details for the new menu item'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Item name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="category">Category *</Label>
              <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Snacks">Snacks</SelectItem>
                  <SelectItem value="Beverages">Beverages</SelectItem>
                  <SelectItem value="Main Course">Main Course</SelectItem>
                  <SelectItem value="Desserts">Desserts</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="price">Price (₹) *</Label>
              <Input
                id="price"
                type="number"
                min="0"
                step="0.01"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Optional description"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
            <Button onClick={handleSaveItem}>
              {editingItem ? 'Update' : 'Add'} Item
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default OwnerDashboard;
