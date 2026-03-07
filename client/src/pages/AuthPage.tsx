import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LayoutDashboard, ArrowRight, ShieldCheck } from "lucide-react";
import { motion } from "framer-motion";

export default function AuthPage() {
  const [, setLocation] = useLocation();
  const { login, isLoggingIn } = useAuth();
  
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await login({ username, password });
      setLocation("/");
    } catch (error) {
      // Error is handled by the hook's toast
    }
  };

  return (
    <div className="min-h-screen w-full flex bg-background">
      {/* Left side - Branding/Visual */}
      <div className="hidden lg:flex w-1/2 relative overflow-hidden bg-primary items-center justify-center">
        <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary/90 to-black/80 z-0" />
        
        {/* Decorative elements */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
          <div className="absolute -top-[20%] -left-[10%] w-[70%] h-[70%] rounded-full bg-white/5 blur-[120px]" />
          <div className="absolute bottom-[10%] -right-[20%] w-[60%] h-[60%] rounded-full bg-blue-400/20 blur-[100px]" />
        </div>

        <div className="relative z-10 p-12 text-primary-foreground max-w-2xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 backdrop-blur-md mb-8 shadow-2xl border border-white/20">
              <ShieldCheck className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-5xl font-extrabold tracking-tight mb-6 leading-tight">
              დილერის განაცხადების <br />
              <span className="text-white/70">პორტალი</span>
            </h1>
            <p className="text-lg text-white/80 leading-relaxed max-w-lg">
              უსაფრთხოდ დაამუშავეთ განაცხადები, დაადასტურეთ პირადობა, გამოთვალეთ სუბსიდია და გააგზავნეთ დასრულებული შეკვეთები ერთ პლატფორმაში.
            </p>
          </motion.div>
        </div>
      </div>

      {/* Right side - Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 sm:p-12 lg:p-24 relative">
        <div className="w-full max-w-md">
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="flex flex-col gap-2 mb-10"
          >
            <div className="flex items-center gap-3 lg:hidden mb-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg">
                <LayoutDashboard className="h-5 w-5" />
              </div>
              <span className="text-2xl font-bold">დილერის პორტალი</span>
            </div>
            
            <h2 className="text-3xl font-bold tracking-tight text-foreground">კეთილი იყოს თქვენი დაბრუნება</h2>
            <p className="text-muted-foreground">პორტალზე შესასვლელად შეიყვანეთ მონაცემები.</p>
          </motion.div>

          <motion.form 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            onSubmit={handleSubmit} 
            className="space-y-6"
          >
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">ელფოსტა ან მომხმარებლის სახელი</Label>
                <Input
                  id="username"
                  placeholder="name@dealer.com"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  className="h-12 px-4 rounded-xl bg-muted/50 border-transparent focus:border-primary focus:bg-background transition-all"
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">პაროლი</Label>
                </div>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="h-12 px-4 rounded-xl bg-muted/50 border-transparent focus:border-primary focus:bg-background transition-all"
                />
              </div>
            </div>

            <Button 
              type="submit" 
              className="w-full h-12 rounded-xl text-base font-semibold shadow-lg shadow-primary/20 hover:shadow-xl hover:-translate-y-0.5 transition-all group"
              disabled={isLoggingIn}
            >
              {isLoggingIn ? "ავთენტიფიკაცია..." : "პორტალზე შესვლა"}
              {!isLoggingIn && <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />}
            </Button>
          </motion.form>
        </div>
      </div>
    </div>
  );
}
