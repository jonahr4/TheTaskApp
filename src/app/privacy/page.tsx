export const metadata = {
    title: "Privacy Policy — TaskApp",
};

export default function PrivacyPage() {
    return (
        <main style={{ maxWidth: 720, margin: "0 auto", padding: "48px 24px", fontFamily: "system-ui" }}>
            <h1>Privacy Policy</h1>
            <p><em>Last updated: February 2026</em></p>

            <h2>What We Collect</h2>
            <p>TaskApp collects the following data when you create an account:</p>
            <ul>
                <li><strong>Email address</strong> — for authentication and account recovery</li>
                <li><strong>Task data</strong> — titles, notes, due dates, priorities, and groups you create</li>
                <li><strong>Calendar tokens</strong> — for iCal feed integration (generated, not personal)</li>
            </ul>

            <h2>How We Store It</h2>
            <p>All data is stored securely in <strong>Google Firebase</strong> (Firestore database and Firebase Authentication). Data is encrypted in transit and at rest.</p>

            <h2>Third-Party Services</h2>
            <ul>
                <li><strong>Firebase</strong> (Google) — Authentication and database</li>
                <li><strong>Azure AI</strong> (Microsoft) — AI task parsing (your task text is sent for processing but not stored by the AI service)</li>
                <li><strong>Google Sign-In</strong> — Optional authentication method</li>
            </ul>

            <h2>What We Don&apos;t Do</h2>
            <ul>
                <li>We do <strong>not</strong> sell your data</li>
                <li>We do <strong>not</strong> use tracking or analytics</li>
                <li>We do <strong>not</strong> share your data with advertisers</li>
            </ul>

            <h2>Data Deletion</h2>
            <p>You can delete your account and all associated data at any time from within the app (Account menu → Delete Account). This permanently removes all your tasks, groups, and account information.</p>

            <h2>Contact</h2>
            <p>Questions? Reach out at <strong>[your email]</strong>.</p>
        </main>
    );
}
