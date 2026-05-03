'use client';

import Link from "next/link";
import { useAuth } from "../lib/auth-context";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LoginPage() {
  const { login, isAuthenticated } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
      await login(email, password);
      router.push("/");
    } catch (err: any) {
      // Handle validation errors from backend
      if (err.message) {
        setError(err.message);
      } else {
        setError("Login failed. Please check your credentials.");
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
          <h1 className="text-4xl font-bold text-[#1E1E1E] mb-2">Welcome Back</h1>
          <p className="text-lg text-[#757575]">Sign in to your account</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-100 text-red-700 rounded-lg text-sm">
            {error}
          </div>
        )}

        {/* Login Form */}
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

          {/* Remember Me & Forgot Password */}
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" className="w-5 h-5 rounded" />
              <span className="text-[#757575] font-medium">Remember me</span>
            </label>
            <Link href="#" className="text-[#FF8D28] font-semibold hover:underline">
              Forgot password?
            </Link>
          </div>

          {/* Sign In Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full px-6 py-3 bg-[#FF8D28] text-black font-bold text-lg rounded-full hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        {/* Divider */}
        <div className="flex items-center gap-4 my-8">
          <div className="flex-1 h-px bg-[#D9D9D9]"></div>
          <span className="text-[#757575] font-semibold">OR</span>
          <div className="flex-1 h-px bg-[#D9D9D9]"></div>
        </div>

        {/* Google Login */}
        <button
          type="button"
          className="w-full px-6 py-3 bg-black text-white font-bold text-lg rounded-full hover:bg-gray-900 transition-colors flex items-center justify-center gap-2"
        >
          <span>Continue with Google</span>
        </button>

        {/* Sign Up Link */}
        <p className="text-center mt-8 text-[#757575]">
          Don't have an account?{" "}
          <Link href="/signup" className="text-[#FF8D28] font-bold hover:underline">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
