'use client';

import Link from "next/link";
import { useAuth } from "../lib/auth-context";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function SignUpPage() {
  const { register, isAuthenticated } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("customer");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (isAuthenticated) {
    router.push("/");
    return null;
  }

  const handleSubmit = async (e: React.SubmitEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await register(email, fullName, password, role);
      router.push("/");
    } catch (err: any) {
      // Handle validation errors from backend
      if (err.message) {
        setError(err.message);
      } else {
        setError("Registration failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center py-12 px-8">
      <div className="w-full max-w-md">
        {/* Heading */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-[#1E1E1E] mb-2">Create Account</h1>
          <p className="text-lg text-[#757575]">Sign up to get started</p>
        </div>
        {error && (
          <div className="mb-6 p-4 bg-red-100 text-red-700 rounded-lg text-sm">
            {error}
          </div>
        )}

        {/* Registration Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Email */}
          <div>
            <label className="block text-lg font-bold text-[#1E1E1E] mb-3">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              required
              className="w-full px-4 py-3 bg-[#F5F5F5] text-[#1E1E1E] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF8D28] placeholder-[#757575]"
            />
          </div>

          {/* Full Name */}
          <div>
            <label className="block text-lg font-bold text-[#1E1E1E] mb-3">
              Full Name
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Enter your full name"
              required
              className="w-full px-4 py-3 bg-[#F5F5F5] text-[#1E1E1E] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF8D28] placeholder-[#757575]"
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-lg font-bold text-[#1E1E1E] mb-3">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
              className="w-full px-4 py-3 bg-[#F5F5F5] text-[#1E1E1E] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF8D28] placeholder-[#757575]"
            />
          </div>

          {/* Role Selection */}
          <div>
            <label className="block text-lg font-bold text-[#1E1E1E] mb-3">
              Account Type
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full px-4 py-3 bg-[#F5F5F5] text-[#1E1E1E] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF8D28]"
            >
              <option value="customer">Customer</option>
              <option value="shop_owner">Shop Owner</option>
              <option value="rider">Rider</option>
            </select>
          </div>

          {/* Sign Up Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full px-6 py-3 bg-[#FF8D28] text-black font-bold text-lg rounded-full hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Creating account..." : "Sign Up"}
          </button>
        </form>


        {/* Sign In Link */}
        <p className="text-center mt-8 text-[#757575]">
          Already have an account?{" "}
          <Link href="/login" className="text-[#FF8D28] font-bold hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
