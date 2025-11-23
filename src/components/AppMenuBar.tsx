import { NavLink } from "@/components/NavLink";
import {
  Menubar,
  MenubarMenu,
  MenubarTrigger,
} from "@/components/ui/menubar";

export function AppMenuBar() {
  return (
    <div className="border-b bg-card">
      <div className="container mx-auto px-4">
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
        </Menubar>
      </div>
    </div>
  );
}
