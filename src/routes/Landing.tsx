import { useNavigate } from "react-router-dom";
import Button from "../components/Button";

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-8 px-6 text-center">
      <div>
        <h1 className="text-3xl font-black tracking-tight text-stone-900">
          Treasure Hunt
        </h1>
        <p className="mt-2 text-lg text-stone-500">Explore. Solve. Race.</p>
      </div>

      <div className="flex w-full max-w-xs flex-col gap-3">
        <Button onClick={() => navigate("/join")}>Join a Hunt</Button>
        <Button variant="ghost" onClick={() => navigate("/host")}>
          I'm the Host
        </Button>
      </div>
    </div>
  );
}
