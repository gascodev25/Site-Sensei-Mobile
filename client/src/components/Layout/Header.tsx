import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { Bell } from "lucide-react";

export default function Header() {
  const { user } = useAuth();
  const [location] = useLocation();

  const navItems = [
    { label: "Dashboard", href: "/", active: location === "/" },
    { label: "Clients", href: "/clients", active: location === "/clients" },
    { label: "Services", href: "/services", active: location === "/services" },
    { label: "Inventory", href: "/inventory", active: location === "/inventory" },
    { label: "Teams", href: "/teams", active: location === "/teams" },
    { label: "Warehouse", href: "/warehouse", active: location === "/warehouse" },
    { label: "Reports", href: "/reports", active: location === "/reports" },
  ];

  const getInitials = (firstName?: string, lastName?: string) => {
    const first = firstName?.[0] || '';
    const last = lastName?.[0] || '';
    return (first + last).toUpperCase() || 'U';
  };

  return (
    <header className="bg-slate-800 text-white shadow-lg">
      <div className="container mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-8">
            <h1 className="text-xl font-bold">ACG Works</h1>
            <nav className="hidden md:flex space-x-6">
              {navItems.map((item) => (
                <Link key={item.href} href={item.href}>
                  <a
                    className={`transition-colors ${
                      item.active
                        ? "text-white"
                        : "text-white/70 hover:text-blue-200"
                    }`}
                    data-testid={`link-${item.label.toLowerCase()}`}
                  >
                    {item.label}
                  </a>
                </Link>
              ))}
            </nav>
          </div>
          
          <div className="flex items-center space-x-4">
            <button 
              className="text-white/70 hover:text-white"
              data-testid="button-notifications"
            >
              <Bell className="h-5 w-5" />
            </button>
            
            <div className="flex items-center space-x-3">
              <span className="hidden sm:block text-sm" data-testid="text-username">
                {user?.firstName && user?.lastName 
                  ? `${user.firstName} ${user.lastName}`
                  : user?.email || 'User'
                }
              </span>
              <div 
                className="w-8 h-8 bg-primary rounded-full flex items-center justify-center"
                data-testid="img-avatar"
              >
                <span className="text-xs font-medium">
                  {getInitials(user?.firstName, user?.lastName)}
                </span>
              </div>
            </div>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={() => window.location.href = "/api/logout"}
              className="text-white/70 hover:text-white hover:bg-white/10"
              data-testid="button-logout"
            >
              Sign Out
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
