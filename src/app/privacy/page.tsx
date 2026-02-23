import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Privacy Policy — TaskApp",
    description:
        "Learn how TaskApp handles your data, what we collect, and how we keep it safe.",
};

export default function PrivacyPage() {
    return (
        <main style={styles.main}>
            <div style={styles.card}>
                <header style={styles.header}>
                    <h1 style={styles.title}>Privacy Policy</h1>
                    <p style={styles.updated}>Last updated: February 2026</p>
                </header>

                <Section title="What We Collect">
                    <p style={styles.text}>
                        TaskApp collects the following data when you create an account:
                    </p>
                    <ul style={styles.list}>
                        <Li label="Email address">
                            for authentication and account recovery
                        </Li>
                        <Li label="Task data">
                            titles, notes, due dates, priorities, and groups you create
                        </Li>
                        <Li label="Calendar tokens">
                            for iCal feed integration (generated, not personal)
                        </Li>
                    </ul>
                </Section>

                <Section title="How We Store It">
                    <p style={styles.text}>
                        All data is stored securely in{" "}
                        <strong>Google Firebase</strong> (Firestore database and Firebase
                        Authentication). Data is encrypted in transit and at rest.
                    </p>
                </Section>

                <Section title="Third-Party Services">
                    <ul style={styles.list}>
                        <Li label="Firebase (Google)">Authentication and database</Li>
                        <Li label="Azure AI (Microsoft)">
                            AI task parsing and chat — your task text is sent for processing
                            but is not stored by the AI service
                        </Li>
                        <Li label="Google Sign-In">Optional authentication method</Li>
                    </ul>
                </Section>

                <Section title="What We Don't Do">
                    <ul style={styles.list}>
                        <Li label="No selling">We do not sell your data</Li>
                        <Li label="No tracking">
                            We do not use tracking or analytics
                        </Li>
                        <Li label="No ads">
                            We do not share your data with advertisers
                        </Li>
                    </ul>
                </Section>

                <Section title="Data Deletion">
                    <p style={styles.text}>
                        You can delete your account and all associated data at any time from
                        within the app (Account&nbsp;menu&nbsp;→&nbsp;Delete&nbsp;Account).
                        This permanently removes all your tasks, groups, and account
                        information.
                    </p>
                </Section>

                <Section title="Contact" last>
                    <p style={styles.text}>
                        Questions? Reach out at{" "}
                        <a href="mailto:jonahrothman@me.com" style={styles.link}>
                            jonahrothman@me.com
                        </a>
                        .
                    </p>
                </Section>
            </div>
        </main>
    );
}

/* ---------- sub-components ---------- */

function Section({
    title,
    children,
    last,
}: {
    title: string;
    children: React.ReactNode;
    last?: boolean;
}) {
    return (
        <section style={{ ...styles.section, ...(last ? { border: "none", paddingBottom: 0 } : {}) }}>
            <h2 style={styles.sectionTitle}>{title}</h2>
            {children}
        </section>
    );
}

function Li({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <li style={styles.listItem}>
            <strong style={styles.label}>{label}</strong>
            <span style={styles.dash}> — </span>
            {children}
        </li>
    );
}

/* ---------- styles ---------- */

const styles: Record<string, React.CSSProperties> = {
    main: {
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "48px 20px",
        background: "#f8f9fb",
        fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', system-ui, sans-serif",
        WebkitFontSmoothing: "antialiased",
    },
    card: {
        width: "100%",
        maxWidth: 680,
        background: "#ffffff",
        borderRadius: 14,
        boxShadow:
            "0 2px 8px rgba(0,0,0,0.06), 0 1px 4px rgba(0,0,0,0.04)",
        padding: "48px 40px",
    },
    header: {
        textAlign: "center" as const,
        marginBottom: 36,
    },
    title: {
        fontSize: "1.75rem",
        fontWeight: 700,
        color: "#1a1d21",
        margin: 0,
        letterSpacing: "-0.01em",
    },
    updated: {
        fontSize: "0.85rem",
        color: "#9aa0a6",
        marginTop: 8,
        fontStyle: "italic",
    },
    section: {
        borderBottom: "1px solid #eef0f2",
        paddingBottom: 24,
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: "1.1rem",
        fontWeight: 650,
        color: "#1a1d21",
        marginBottom: 10,
        marginTop: 0,
    },
    text: {
        fontSize: "0.95rem",
        lineHeight: 1.7,
        color: "#5f6368",
        margin: 0,
    },
    list: {
        paddingLeft: 20,
        margin: 0,
    },
    listItem: {
        fontSize: "0.95rem",
        lineHeight: 1.7,
        color: "#5f6368",
        marginBottom: 4,
    },
    label: {
        color: "#1a1d21",
    },
    dash: {
        color: "#9aa0a6",
    },
    link: {
        color: "#4f46e5",
        textDecoration: "none",
        fontWeight: 600,
    },
};
