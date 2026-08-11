import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import MobileStudentApp from "../../../app/mobile-student-app";
import { demoCoaches } from "../../../app/mobile/demo-data";
import { usesBundledDemoData } from "../../../app/mobile/api-client";
import "../../../app/globals.css";
import "../../../app/mobile/mobile.css";
import "./native.css";

function NativeMobileApp() {
  const demoMode = usesBundledDemoData();
  const [audience, setAudience] = useState("青少年");
  const [city, setCity] = useState("北京");
  const [goal, setGoal] = useState("短跑专项");
  const [savedCoachIds, setSavedCoachIds] = useState<number[]>([]);
  const [selectedCoachId, setSelectedCoachId] = useState(5);
  const [sport, setSport] = useState("田径");

  return (
    <MobileStudentApp
      audience={audience}
      city={city}
      coaches={demoCoaches}
      goal={goal}
      onBook={() => {}}
      onChangeAudience={setAudience}
      onChangeCity={setCity}
      onChangeGoal={setGoal}
      onChangeSport={setSport}
      onSelectCoach={setSelectedCoachId}
      onToggleSaved={(id) => {
        setSavedCoachIds((current) => current.includes(id) ? current.filter((coachId) => coachId !== id) : [...current, id]);
      }}
      savedCoachIds={savedCoachIds}
      selectedCoachId={selectedCoachId}
      sport={sport}
    />
  );
}

const root = document.getElementById("root");

if (!root) throw new Error("Native app root is missing");

createRoot(root).render(
  <StrictMode>
    <NativeMobileApp />
  </StrictMode>,
);
