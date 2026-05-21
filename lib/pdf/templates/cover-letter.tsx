import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { CoverLetter } from "@/lib/schemas/cover-letter";

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
  recipient: {
    marginBottom: 16,
  },
  paragraph: {
    marginBottom: 12,
  },
  signoff: {
    marginTop: 16,
  },
});

export function CoverLetterDocument({ letter }: { letter: CoverLetter }) {
  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.recipient}>
          {letter.recipient.name ? <Text>{letter.recipient.name}</Text> : null}
          <Text>{letter.recipient.company}</Text>
          {letter.recipient.address ? <Text>{letter.recipient.address}</Text> : null}
        </View>
        {letter.paragraphs.map((p, i) => (
          <Text key={`p-${i}`} style={styles.paragraph}>
            {p.text}
          </Text>
        ))}
        <Text style={styles.signoff}>{letter.signoff}</Text>
        <Text>{letter.signature}</Text>
      </Page>
    </Document>
  );
}
