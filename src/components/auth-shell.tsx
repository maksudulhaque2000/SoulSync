"use client";

import { motion } from "framer-motion";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";

import { cn } from "@/lib/utils";

type LoginForm = {
  email: string;
  password: string;
};

type RegisterForm = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
};

const authMessages = {
  login: {
    title: "Welcome Back To SoulSync",
    subtitle:
      "Your private universe of thoughts, reflections, and stories is waiting. Sign in and continue your depth.",
    accent: "Where minds resonate, stories heal.",
  },
  register: {
    title: "Begin Your SoulSync Journey",
    subtitle:
      "Create your account and shape a meaningful profile where your words, images, and voice become living memories.",
    accent: "Every connection starts with one authentic hello.",
  },
};

export default function AuthShell() {
  const router = useRouter();
  const [isRegister, setIsRegister] = useState(false);
  const [loading, setLoading] = useState(false);

  const loginForm = useForm<LoginForm>({
    defaultValues: { email: "", password: "" },
  });

  const registerForm = useForm<RegisterForm>({
    defaultValues: { firstName: "", lastName: "", email: "", password: "" },
  });

  const handleLogin = loginForm.handleSubmit(async (values) => {
    setLoading(true);
    const result = await signIn("credentials", {
      email: values.email,
      password: values.password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      toast.error("Login failed. Please check email and password.");
      return;
    }

    toast.success("Welcome to SoulSync.");
    router.push("/feed");
    router.refresh();
  });

  const handleRegister = registerForm.handleSubmit(async (values) => {
    setLoading(true);
    const create = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });

    if (!create.ok) {
      setLoading(false);
      const data = await create.json().catch(() => ({}));
      toast.error(data.error ?? "Registration failed.");
      return;
    }

    const result = await signIn("credentials", {
      email: values.email,
      password: values.password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      toast.success("Account created. Please login.");
      setIsRegister(false);
      return;
    }

    toast.success("Account ready. Welcome to SoulSync.");
    router.push("/feed");
    router.refresh();
  });

  return (
    <div className="relative h-svh overflow-hidden bg-[radial-gradient(circle_at_20%_20%,#1f2937,transparent_40%),radial-gradient(circle_at_80%_10%,#172554,transparent_40%),linear-gradient(140deg,#030712,#0f172a,#111827)] text-slate-100">
      <motion.div
        className="pointer-events-none absolute -left-20 top-20 h-64 w-64 rounded-full bg-cyan-500/20 blur-3xl"
        animate={{ x: [0, 30, 0], y: [0, -15, 0] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="pointer-events-none absolute -right-16 bottom-10 h-72 w-72 rounded-full bg-fuchsia-500/15 blur-3xl"
        animate={{ x: [0, -25, 0], y: [0, 20, 0] }}
        transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
      />

      <div className="relative mx-auto flex h-full w-full max-w-6xl items-center justify-center px-4 py-4 md:px-8">
        <div className="grid h-full max-h-190 w-full grid-cols-1 gap-4 overflow-hidden rounded-3xl border border-slate-700/60 bg-slate-900/40 p-3 backdrop-blur-xl md:grid-cols-2 md:gap-3 md:p-4">
          <motion.section
            className={cn(
              "relative flex flex-col justify-center rounded-2xl border border-slate-700/50 bg-slate-950/70 p-6 md:p-10",
              isRegister ? "md:order-2" : "md:order-1"
            )}
            layout
            transition={{ type: "spring", stiffness: 90, damping: 18 }}
          >
            <p className="mb-2 text-xs uppercase tracking-[0.28em] text-cyan-300/80">
              {isRegister ? "Create Account" : "Sign In"}
            </p>
            <h1 className="font-display text-3xl font-bold leading-tight md:text-4xl">
              {isRegister ? "Write your first chapter." : "Enter your inner feed."}
            </h1>

            {!isRegister ? (
              <form onSubmit={handleLogin} className="mt-8 space-y-4">
                <input
                  {...loginForm.register("email", { required: true })}
                  type="email"
                  placeholder="Email"
                  className="auth-input"
                />
                <input
                  {...loginForm.register("password", { required: true })}
                  type="password"
                  placeholder="Password"
                  className="auth-input"
                />
                <button disabled={loading} className="auth-button" type="submit">
                  {loading ? "Entering..." : "Login"}
                </button>
                <div className="rounded-xl border border-cyan-500/35 bg-cyan-500/10 px-3 py-2 text-xs text-cyan-100">
                  Admin access: admin@gmail.com / Password@123
                </div>
                <p className="text-sm text-slate-400">
                  New here?{" "}
                  <button
                    className="font-semibold text-cyan-300 hover:text-cyan-200"
                    onClick={() => setIsRegister(true)}
                    type="button"
                  >
                    Switch to Register
                  </button>
                </p>
              </form>
            ) : (
              <form onSubmit={handleRegister} className="mt-8 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <input
                    {...registerForm.register("firstName", { required: true })}
                    placeholder="First name"
                    className="auth-input"
                  />
                  <input
                    {...registerForm.register("lastName", { required: true })}
                    placeholder="Last name"
                    className="auth-input"
                  />
                </div>
                <input
                  {...registerForm.register("email", { required: true })}
                  type="email"
                  placeholder="Email"
                  className="auth-input"
                />
                <input
                  {...registerForm.register("password", { required: true, minLength: 6 })}
                  type="password"
                  placeholder="Password"
                  className="auth-input"
                />
                <button disabled={loading} className="auth-button" type="submit">
                  {loading ? "Creating..." : "Register"}
                </button>
                <p className="text-sm text-slate-400">
                  Already have account?{" "}
                  <button
                    className="font-semibold text-cyan-300 hover:text-cyan-200"
                    onClick={() => setIsRegister(false)}
                    type="button"
                  >
                    Switch to Login
                  </button>
                </p>
              </form>
            )}
          </motion.section>

          <motion.section
            className={cn(
              "flex flex-col justify-center rounded-2xl border border-indigo-500/30 bg-linear-to-br from-indigo-900/40 via-slate-900 to-cyan-950/40 p-6 md:p-10",
              isRegister ? "md:order-1" : "md:order-2"
            )}
            layout
            transition={{ type: "spring", stiffness: 90, damping: 18 }}
          >
            <motion.p
              key={isRegister ? "register-label" : "login-label"}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45 }}
              className="text-xs uppercase tracking-[0.26em] text-cyan-300"
            >
              SoulSync Narrative
            </motion.p>
            <motion.h2
              key={isRegister ? "register-title" : "login-title"}
              initial={{ opacity: 0, x: 14 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.55 }}
              className="mt-4 font-display text-3xl font-bold leading-tight md:text-4xl"
            >
              {isRegister ? authMessages.register.title : authMessages.login.title}
            </motion.h2>
            <motion.p
              key={isRegister ? "register-subtitle" : "login-subtitle"}
              initial={{ opacity: 0, x: -14 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.55, delay: 0.06 }}
              className="mt-4 max-w-md text-slate-300"
            >
              {isRegister ? authMessages.register.subtitle : authMessages.login.subtitle}
            </motion.p>
            <motion.p
              key={isRegister ? "register-accent" : "login-accent"}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.55, delay: 0.12 }}
              className="mt-8 border-l-2 border-cyan-400/70 pl-4 text-sm text-cyan-100"
            >
              {isRegister ? authMessages.register.accent : authMessages.login.accent}
            </motion.p>
          </motion.section>
        </div>
      </div>
    </div>
  );
}
