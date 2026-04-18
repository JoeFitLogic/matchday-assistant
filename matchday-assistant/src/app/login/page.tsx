import LoginForm from "./LoginForm";

export const metadata = { title: "Sign in · Matchday OS" };

export default function LoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-500 text-slate-950 font-black text-2xl mb-4">
            M
          </div>
          <h1 className="text-2xl font-bold">Matchday OS</h1>
          <p className="text-slate-400 text-sm mt-1">Sign in to run your session</p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
