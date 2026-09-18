import { WifiOff, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

export const OfflineFallback = () => {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6">

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 text-center max-w-sm"
      >
        <div className="w-16 h-16 rounded-2xl bg-card border border-border/60 flex items-center justify-center mx-auto mb-6">
          <WifiOff className="w-8 h-8 text-muted-foreground" />
        </div>

        <h1 className="text-2xl font-display font-bold text-foreground mb-2">
          You're Offline
        </h1>
        <p className="text-muted-foreground text-sm mb-8">
          It looks like you've lost your internet connection. Check your Wi-Fi or mobile data and try again.
        </p>

        <Button
          onClick={() => window.location.reload()}
          className="hover:scale-[1.02] active:scale-[0.98]"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Try Again
        </Button>
      </motion.div>
    </div>
  );
};
