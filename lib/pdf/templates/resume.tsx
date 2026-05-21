import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { TailoredResume } from "@/lib/schemas/tailored-resume";

const styles = StyleSheet.create({
  page: {
    paddingTop: 43.2,
    paddingBottom: 43.2,
    paddingHorizontal: 43.2,
    fontFamily: "Helvetica",
    fontSize: 11,
    lineHeight: 1.4,
    color: "#000",
  },
  name: {
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
    marginBottom: 4,
  },
  contact: {
    fontSize: 10,
    color: "#333",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    marginTop: 12,
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  bulletRow: {
    flexDirection: "row",
    marginBottom: 2,
  },
  bullet: {
    width: 12,
  },
  bulletText: {
    flex: 1,
  },
});

function joinContact(c: TailoredResume["contactBlock"]): string {
  return [c.email, c.phone, c.linkedinUrl, c.location].filter(Boolean).join(" · ");
}

export function ResumeDocument({ resume }: { resume: TailoredResume }) {
  const ordered = [...resume.sections].sort((a, b) => a.order - b.order);
  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.name}>{resume.candidateName}</Text>
        <Text style={styles.contact}>{joinContact(resume.contactBlock)}</Text>
        {ordered.map((section, idx) => {
          if (section.type === "HEADER") return null;
          return (
            <View key={`section-${idx}`} wrap={false}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
              {section.bullets.map((b, i) => (
                <View key={`b-${idx}-${i}`} style={styles.bulletRow}>
                  <Text style={styles.bullet}>•</Text>
                  <Text style={styles.bulletText}>{b.text}</Text>
                </View>
              ))}
            </View>
          );
        })}
      </Page>
    </Document>
  );
}
