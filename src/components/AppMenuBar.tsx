import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import {
  Menubar,
  MenubarMenu,
  MenubarTrigger,
} from "@/components/ui/menubar";
import { GlobalSearch } from "@/components/GlobalSearch";

export function AppMenuBar() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Don't show menu bar on auth page
  if (location.pathname === "/auth" || !user) {
    return null;
  }

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  return (
    <div className="border-b bg-card">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between gap-4">
          <Menubar className="border-0 bg-transparent">
            <MenubarMenu>
              <NavLink to="/">
                <MenubarTrigger className="cursor-pointer">Inventory</MenubarTrigger>
              </NavLink>
            </MenubarMenu>
            <MenubarMenu>
              <NavLink to="/crm">
                <MenubarTrigger className="cursor-pointer">CRM</MenubarTrigger>
              </NavLink>
            </MenubarMenu>
            <MenubarMenu>
              <NavLink to="/accounting">
                <MenubarTrigger className="cursor-pointer">Accounting</MenubarTrigger>
              </NavLink>
            </MenubarMenu>
          </Menubar>
          <div className="flex items-center gap-2">
            <GlobalSearch />
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSignOut}
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
