"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import AuthCard from "../../components/AuthCard";

export default function SignUp() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSignUp = async () => {
    if (!name || !email || !password) {
      alert("Please fill in all fields");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "Signup failed");
        setLoading(false);
        return;
      }

      // Store user locally
      localStorage.setItem("currentUser", JSON.stringify(data.user));

      switch (data.user.role) {
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
      console.error("Signup error:", err);
      alert("Server error, please try again later");
      setLoading(false);
    }
  };

  return (
    <AuthCard title="Create Account">
      <label>Name</label>
      <input
        type="text"
        className="w-full p-1 mb-3 rounded bg-gray-300"
        value={name}
        onChange={(e) => setName(e.target.value)}
        disabled={loading}
      />

      <label>Email</label>
      <input
        type="email"
        className="w-full p-1 mb-3 rounded bg-gray-300"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        disabled={loading}
      />

      <label>Password</label>
      <input
        type="password"
        className="w-full p-1 mb-3 rounded bg-gray-300"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        disabled={loading}
      />

      <p className="text-xs text-white/80 mb-3">
        New accounts are created as a standard user. An admin can change your role later.
      </p>

      <button
        onClick={handleSignUp}
        className="w-full py-1 text-white rounded bg-gradient-to-r from-indigo-500 to-purple-600"
        disabled={loading}
      >
        {loading ? "Creating Account..." : "Sign Up"}
      </button>

      <p className="text-center mt-4 text-sm">
        Already have an account?{" "}
        <Link
          href="/login"
          className="text-indigo-600 font-semibold hover:underline"
        >
          Login
        </Link>
      </p>
    </AuthCard>
  );
}