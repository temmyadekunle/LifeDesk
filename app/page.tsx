import LivantaApp from "@/components/LivantaApp";
import InstallPrompt from "@/components/InstallPrompt";

export default function Page() {
  return (
    <>
      <LivantaApp />
      {/*
        Mounted as a sibling rather than inside LivantaApp. LivantaApp returns
        early for onboarding and for auth, so anything placed inside it would
        be unmounted exactly when the user is most likely to want to install:
        their first run, before they have committed to anything.
      */}
      <InstallPrompt />
    </>
  );
}
