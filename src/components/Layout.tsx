import { NavLink, Outlet } from "react-router-dom";
import { LayoutDashboard, MessageCircle, NotebookPen, Settings } from "lucide-react";

const tabs = [
  { to: "/hoje", label: "Hoje", icon: LayoutDashboard },
  { to: "/chat", label: "Coach", icon: MessageCircle },
  { to: "/registros", label: "Registros", icon: NotebookPen },
  { to: "/config", label: "Config", icon: Settings },
];

export default function Layout() {
  return (
    <div className="flex h-full flex-col">
      <main className="flex-1 overflow-hidden">
        <Outlet />
      </main>
      <nav className="shrink-0 border-t border-stone-200 bg-white">
        <ul className="mx-auto flex max-w-2xl">
          {tabs.map(({ to, label, icon: Icon }) => (
            <li key={to} className="flex-1">
              <NavLink
                to={to}
                className={({ isActive }) =>
                  `flex flex-col items-center gap-0.5 py-2 text-xs ${
                    isActive ? "text-brand-700 font-medium" : "text-stone-500"
                  }`
                }
              >
                <Icon size={22} strokeWidth={1.75} />
                {label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
