import { useState } from "react";
import { useAuth } from "@/context/auth-context";
import { Button } from "@/components/ui/button";
import { Menu, Settings } from "lucide-react";
import { useLocation } from "wouter";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Tabs } from "./tabs";

export default function Header() {
  const { user } = useAuth();
  const [location] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <header className="bg-primary text-white py-3 px-4 flex items-center justify-between shadow-md">
      <div className="flex items-center">
        <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="mr-3 text-white">
              <Menu />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0">
            <div className="bg-primary text-white p-4">
              <h2 className="text-xl font-semibold">Emergency Recovery Chat</h2>
            </div>
            <nav className="p-4">
              <Tabs currentPath={location} vertical onNavigate={() => setSidebarOpen(false)} />
            </nav>
          </SheetContent>
        </Sheet>
        <h1 className="text-xl font-semibold">Emergency Recovery Chat</h1>
      </div>
      <div className="flex items-center">
        <Button 
          variant="ghost" 
          size="icon" 
          className="ml-2 text-white"
          onClick={() => location !== "/settings" && window.location.assign("/settings")}
        >
          <Settings />
        </Button>
        <div className="ml-3 flex items-center">
          <span className="material-icons mr-1">account_circle</span>
          <span className="text-sm">{user?.displayName}</span>
          <span className="ml-2 bg-secondary text-white text-xs px-2 py-0.5 rounded-full">
            {user?.role === "admin" ? "管理者" : "一般"}
          </span>
        </div>
      </div>
    </header>
  );
}
