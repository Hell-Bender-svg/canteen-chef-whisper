import { UtensilsCrossed, User, LogOut, Shield, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate, Link } from "react-router-dom";
import { useUserRole } from "@/hooks/useUserRole";

interface NavbarProps {
  user: any;
  onSignOut?: () => void;
  cartButton?: React.ReactNode;
}

export const Navbar = ({ user, onSignOut, cartButton }: NavbarProps) => {
  const navigate = useNavigate();
  const { isOwner, isAdmin } = useUserRole();

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-background/80 backdrop-blur-lg">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-primary-glow flex items-center justify-center">
            <UtensilsCrossed className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">AKGEC</h1>
            <p className="text-xs text-muted-foreground">Canteen</p>
          </div>
        </Link>
        
        <div className="flex items-center gap-2">
          {isOwner && (
            <Link to="/owner">
              <Button variant="outline" size="sm" className="gap-2">
                <Store className="h-4 w-4" />
                <span className="hidden sm:inline">Dashboard</span>
              </Button>
            </Link>
          )}
          {isAdmin && (
            <Link to="/admin">
              <Button variant="outline" size="sm" className="gap-2">
                <Shield className="h-4 w-4" />
                <span className="hidden sm:inline">Admin</span>
              </Button>
            </Link>
          )}
          {cartButton}
          
          {user ? (
            <Button variant="outline" size="sm" className="gap-2" onClick={onSignOut}>
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Sign Out</span>
            </Button>
          ) : (
            <Button variant="outline" size="sm" className="gap-2" onClick={() => navigate("/auth")}>
              <User className="w-4 h-4" />
              <span className="hidden sm:inline">Sign In</span>
            </Button>
          )}
        </div>
      </div>
    </nav>
  );
};