import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
    title: "Support — TaskApp",
    description:
        "Get help with TaskApp. Find answers to common questions or contact support.",
};

const faqs: { q: string; a: string }[] = [
    {
        q: "Is TaskApp free?",
        a: "Yes, TaskApp is 100% free with no ads, subscriptions, or in-app purchases.",
    },
    {
        q: "How do I create tasks with AI?",
        a: "Tap the AI button and type what you need in plain English. The AI will create tasks with smart dates and priorities.",
    },
    {
        q: "Does TaskApp sync across devices?",
        a: "Yes, your tasks sync to the cloud and are accessible from the web app and mobile app.",
    },
    {
        q: "How do I use widgets?",
        a: "Long press your home screen, tap the + button, and search for TaskApp. Choose from the Today Dashboard, Next Task, or AI Quick Action widget.",
    },
];

export default function SupportPage() {
    return (
        <main style={styles.main}>
            <div style={styles.card}>
                {/* --- Header --- */}
                <header style={styles.header}>
                    <h1 style={styles.title}>TaskApp Support</h1>
                    <p style={styles.subtitle}>
                        A smarter way to manage your tasks — with AI-powered parsing,
                        Eisenhower&nbsp;Matrix prioritization, and seamless cloud sync.
                    </p>
                </header>

                {/* --- Contact --- */}
                <Section title="Contact Support">
                    <p style={styles.text}>
                        Need help or have feedback? Reach out anytime at{" "}
                        <a href="mailto:jonahrothman@me.com" style={styles.link}>
                            jonahrothman@me.com
                        </a>
                        .
                    </p>
                </Section>

                {/* --- FAQ --- */}
                <Section title="Frequently Asked Questions">
                    <div style={styles.faqList}>
                        {faqs.map((faq, i) => (
                            <div key={i} style={styles.faqItem}>
                                <p style={styles.question}>{faq.q}</p>
                                <p style={styles.answer}>{faq.a}</p>
                            </div>
                        ))}
                    </div>
                </Section>

                {/* --- Privacy --- */}
                <Section title="Privacy" last>
                    <p style={styles.text}>
                        Your privacy matters.{" "}
                        <Link href="/privacy" style={styles.link}>
                            Read our Privacy Policy
                        </Link>{" "}
                        to learn how TaskApp handles your data.
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
        <section
            style={{
                ...styles.section,
                ...(last ? { border: "none", paddingBottom: 0 } : {}),
            }}
        >
            <h2 style={styles.sectionTitle}>{title}</h2>
            {children}
        </section>
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
        boxShadow: "0 2px 8px rgba(0,0,0,0.06), 0 1px 4px rgba(0,0,0,0.04)",
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
    subtitle: {
        fontSize: "0.95rem",
        color: "#5f6368",
        marginTop: 10,
        lineHeight: 1.6,
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
    link: {
        color: "#4f46e5",
        textDecoration: "none",
        fontWeight: 600,
    },
    faqList: {
        display: "flex",
        flexDirection: "column" as const,
        gap: 16,
    },
    faqItem: {
        background: "#f8f9fb",
        borderRadius: 10,
        padding: "16px 20px",
    },
    question: {
        fontSize: "0.95rem",
        fontWeight: 600,
        color: "#1a1d21",
        margin: 0,
        marginBottom: 4,
    },
    answer: {
        fontSize: "0.9rem",
        lineHeight: 1.6,
        color: "#5f6368",
        margin: 0,
    },
};
