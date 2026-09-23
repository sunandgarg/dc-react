const DOWNLOAD_LINKS = '<p>Download the official <a href="https://cbseacademic.nic.in/SQP_CLASSX_2026-27.html">CBSE Class 10 sample papers and marking schemes</a> or the <a href="https://cbseacademic.nic.in/SQP_CLASSXII_2026-27.html">CBSE Class 12 sample papers and marking schemes</a>. Choose your subject on the CBSE page.</p>';

/** Restore the missing official downloads on the published 2027 CBSE SQP story. */
export function addCbseSamplePaperLinks(title: string, content: string): string {
  if (!/CBSE Sample Papers 2027/i.test(title) || /SQP_CLASSX(?:II)?_2026-27\.html/i.test(content)) return content;
  const heading = /(<h[2-4]\b[^>]*>\s*Click here to Download SQPs\s*<\/h[2-4]>)/i;
  return heading.test(content) ? content.replace(heading, `$1${DOWNLOAD_LINKS}`) : `${DOWNLOAD_LINKS}${content}`;
}
