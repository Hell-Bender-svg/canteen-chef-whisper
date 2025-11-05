import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const useUserRole = () => {
  const [roles, setRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUserRoles();
  }, []);

  const fetchUserRoles = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        setRoles([]);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id);

      if (error) throw error;

      setRoles(data?.map(r => r.role) || []);
    } catch (error) {
      console.error('Error fetching user roles:', error);
      setRoles([]);
    } finally {
      setLoading(false);
    }
  };

  const hasRole = (role: string) => roles.includes(role);
  const isOwner = hasRole('owner');
  const isAdmin = hasRole('admin');

  return { roles, loading, hasRole, isOwner, isAdmin, refetch: fetchUserRoles };
};
