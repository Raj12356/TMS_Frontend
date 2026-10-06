import { ReactNode } from "react";

interface AuthCardProps {
  title: string;
  children: ReactNode;
}

export default function AuthCard({ title, children }: AuthCardProps) {
  return (
    <div
      className="flex items-center justify-center min-h-screen bg-cover bg-center relative"
      style={{ backgroundImage: "url('/image1.jpg')" }}
    >
      {/* dark overlay */}
      <div className="absolute inset-0 bg-black/60"></div>

      {/* card */}
      <div className="relative bg-white/10 backdrop-blur-md shadow-lg rounded-xl p-4 sm:p-6 w-full max-w-sm">
        <h1 className="text-xl font-bold text-center mb-6 text-white">
          {title}
        </h1>

       <div className="text-black">{children}</div>
      </div>
    </div>
  );
}