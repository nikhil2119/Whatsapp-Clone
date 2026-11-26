import { Sun, Moon } from "lucide-react";
import { useTheme } from "../hooks/useTheme";

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
      title={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
      className="
        flex items-center justify-center
        h-10 w-10 rounded-full
        border border-gray-200
        bg-white text-gray-700
        hover:bg-gray-100
        dark:border-gray-700
        dark:bg-gray-800
        dark:text-yellow-400
        dark:hover:bg-gray-700
        transition-colors duration-200
      "
    >
      {theme === "light" ? (
        <Moon size={20} />
      ) : (
        <Sun size={20} />
      )}
    </button>
  );
}

export default ThemeToggle;