"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import AuthCard from "../../components/AuthCard";

interface User {
  name: string;
  email: string;
  role: "admin" | "user" | "manager" |"team member";
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      alert("Please enter email and password");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      setLoading(false);

      if (!res.ok) {
        alert(data.error || "Login failed");
        return;
      }

      // Save user in localStorage for session
      localStorage.setItem("currentUser", JSON.stringify(data.user));

      // Redirect based on role
      switch (data.user.role) {
        case "admin":
          router.push("/admin");
          break;
        case "manager":
          router.push("/manager");
          break;
        case "team member":
          router.push("/team-member");
          break;
        default:
          router.push("/user");
      }
    } catch (err) {
      setLoading(false);
      console.error(err);
      alert("Server error");
    }
  };

  return (
    <AuthCard title="Welcome Back">
      <label>Email</label>
      <input
        type="email"
        className="w-full p-2 mb-3 rounded bg-gray-300"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />

      <label>Password</label>
      <input
        type="password"
        className="w-full p-2 mb-3 rounded bg-gray-300"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />

      <button
        onClick={handleLogin}
        className="w-full py-2 text-white rounded bg-gradient-to-r from-indigo-500 to-purple-600"
        disabled={loading}
      >
        {loading ? "Logging in..." : "Login"}
      </button>

      <p className="text-center mt-4 text-sm">
        Don't have an account?{" "}
        <Link
          href="/signup"
          className="text-indigo-600 font-semibold hover:underline"
        >
          Sign up
        </Link>
      </p>
    </AuthCard>
  );
}