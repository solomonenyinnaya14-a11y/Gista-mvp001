import Link from "next/link";

export default function PrivacyPage() {
  return <main className="content">
    <header className="simple-header"><Link href="/settings">‹ Settings</Link><strong>Privacy</strong><span /></header>
    <section className="create-card">
      <h2>Your privacy on Gista</h2>
      <p>Gista uses your account information and content to provide the service, including your profile, Posts, Gists, responses, follows, saves and notifications.</p>
      <h3>Account information</h3><p>Your email is used for authentication and account security. Your profile information is shown according to your account privacy settings.</p>
      <h3>Private accounts</h3><p>When your account is private, your profile and Gists are restricted to you and people who follow you.</p>
      <h3>Your controls</h3><p>You can edit your profile, make your account private, block users, mark content Not Interested, save content, and delete your account.</p>
      <h3>Security</h3><p>Gista uses authentication, database access controls and storage policies to restrict unauthorized access.</p>
      <h3>Account deletion</h3><p>You can permanently delete your account from Settings. Deletion removes the account through Gista&apos;s account-deletion process.</p>
      <p><strong>Note:</strong> This is the MVP privacy information page, not a substitute for a formal legal privacy policy.</p>
    </section>
  </main>;
}