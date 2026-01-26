import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { Settings2, LayoutDashboard, Code } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { LogOut, RefreshCw, Download, Bot, BarChart3, Trophy } from "lucide-react";
import {
  Menubar,
  MenubarMenu,
  MenubarTrigger,
} from "@/components/ui/menubar";
import { GlobalSearch } from "@/components/GlobalSearch";

export function AppMenuBar() {
  const { user, signOut } = useAuth();
  const { role, loading: roleLoading, isSalesman, isOwner, isDeveloper, hasInternalAccess, hasOwnerAccess } = useUserRole();
  const navigate = useNavigate();
  const location = useLocation();

  // Don't show menu bar on auth page or when not logged in
  if (location.pathname === "/auth" || !user) {
    return null;
  }

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  // Show minimal menu while role is loading
  if (roleLoading) {
    return (
      <div className="w-full overflow-x-hidden">
        <div className="w-full h-8 bg-[hsl(220,60%,15%)]" />
        <div className="border-b bg-card w-full">
          <div className="px-2 sm:px-4 w-full">
            <div className="flex flex-wrap items-center justify-between gap-2 py-2">
              <Menubar className="border-0 bg-transparent flex-wrap h-auto">
                <MenubarMenu>
                  <MenubarTrigger className="cursor-pointer text-sm px-2 py-1 text-muted-foreground">
                    Loading...
                  </MenubarTrigger>
                </MenubarMenu>
              </Menubar>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSignOut}
                className="px-2"
              >
                <LogOut className="h-5 w-5" strokeWidth={3} />
                <span className="hidden sm:inline ml-2">Sign Out</span>
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full relative z-[100]">
      {/* Dark navy banner */}
      <div className="w-full h-8 bg-[hsl(220,60%,15%)]" />
      
      {/* Menu bar */}
      <div className="border-b bg-card w-full">
        <div className="px-2 sm:px-4 w-full">
          <div className="flex flex-wrap items-center justify-between gap-2 py-2">
            <Menubar className="border-0 bg-transparent flex-wrap h-auto">
              {/* Spiff Program - only for salesmen */}
              {isSalesman() && (
                <MenubarMenu>
                  <NavLink to="/spiff-program">
                    <MenubarTrigger className="cursor-pointer flex items-center gap-1 text-sm px-2 py-1">
                      <Trophy className="h-5 w-5 text-yellow-500" strokeWidth={3} />
                      Spiff Program
                    </MenubarTrigger>
                  </NavLink>
                </MenubarMenu>
              )}
              
              {/* Internal access only - owners and employees */}
              {hasInternalAccess() && (
                <>
                  <MenubarMenu>
                    <NavLink to="/dashboard">
                      <MenubarTrigger className="cursor-pointer flex items-center gap-1 text-sm px-2 py-1">
                        <LayoutDashboard className="h-5 w-5" strokeWidth={3} />
                        Dashboard
                      </MenubarTrigger>
                    </NavLink>
                  </MenubarMenu>
                  <MenubarMenu>
                    <NavLink to="/">
                      <MenubarTrigger className="cursor-pointer text-sm px-2 py-1">Inventory</MenubarTrigger>
                    </NavLink>
                  </MenubarMenu>
                  <MenubarMenu>
                    <NavLink to="/crm">
                      <MenubarTrigger className="cursor-pointer text-sm px-2 py-1">CRM</MenubarTrigger>
                    </NavLink>
                  </MenubarMenu>
                  <MenubarMenu>
                    <NavLink to="/accounting">
                      <MenubarTrigger className="cursor-pointer text-sm px-2 py-1">Accounting</MenubarTrigger>
                    </NavLink>
                  </MenubarMenu>
                  <MenubarMenu>
                    <NavLink to="/ai-assistant">
                      <MenubarTrigger className="cursor-pointer flex items-center gap-1 text-sm px-2 py-1">
                        <Bot className="h-5 w-5" strokeWidth={3} />
                        AI Assistant
                      </MenubarTrigger>
                    </NavLink>
                  </MenubarMenu>
                  <MenubarMenu>
                    <NavLink to="/analytics">
                      <MenubarTrigger className="cursor-pointer flex items-center gap-1 text-sm px-2 py-1">
                        <BarChart3 className="h-5 w-5" strokeWidth={3} />
                        Analytics
                      </MenubarTrigger>
                    </NavLink>
                  </MenubarMenu>
                  <MenubarMenu>
                    <NavLink to="/sync">
                      <MenubarTrigger className="cursor-pointer flex items-center gap-1 text-sm px-2 py-1">
                        <RefreshCw className="h-5 w-5" strokeWidth={3} />
                        Sync
                      </MenubarTrigger>
                    </NavLink>
                  </MenubarMenu>
                  <MenubarMenu>
                    <NavLink to="/install">
                      <MenubarTrigger className="cursor-pointer flex items-center gap-1 text-sm px-2 py-1">
                        <Download className="h-5 w-5" strokeWidth={3} />
                        Install
                      </MenubarTrigger>
                    </NavLink>
                  </MenubarMenu>
                  {hasOwnerAccess() && (
                    <>
                      <MenubarMenu>
                        <NavLink to="/spiff-program">
                          <MenubarTrigger className="cursor-pointer flex items-center gap-1 text-sm px-2 py-1">
                            <Trophy className="h-5 w-5 text-yellow-500" strokeWidth={3} />
                            Spiff Program
                          </MenubarTrigger>
                        </NavLink>
                      </MenubarMenu>
                      <MenubarMenu>
                        <NavLink to="/spiff-admin">
                          <MenubarTrigger className="cursor-pointer flex items-center gap-1 text-sm px-2 py-1">
                            <Settings2 className="h-5 w-5" strokeWidth={3} />
                            Spiff Admin
                          </MenubarTrigger>
                        </NavLink>
                      </MenubarMenu>
                      <MenubarMenu>
                        <NavLink to="/developer">
                          <MenubarTrigger className="cursor-pointer flex items-center gap-1 text-sm px-2 py-1">
                            <Code className="h-5 w-5" strokeWidth={3} />
                            Developer
                          </MenubarTrigger>
                        </NavLink>
                      </MenubarMenu>
                    </>
                  )}
                </>
              )}
            </Menubar>
            <div className="flex items-center gap-1 sm:gap-2">
              {/* Only show search for internal users */}
              {hasInternalAccess() && <GlobalSearch />}
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSignOut}
                className="px-2"
              >
                <LogOut className="h-5 w-5" strokeWidth={3} />
                <span className="hidden sm:inline ml-2">Sign Out</span>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
