export async function exportElementToPdf(element: HTMLElement, fileName: string): Promise<void> {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas'), import('jspdf')]);

  const canvas = await html2canvas(element, {
    backgroundColor: '#ffffff',
    scale: 2,
    useCORS: true,
    logging: false,
  });

  const imageData = canvas.toDataURL('image/png');
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const imageWidth = pageWidth - 16;
  const imageHeight = (canvas.height * imageWidth) / canvas.width;

  let renderedHeight = imageHeight;
  let yPosition = 8;

  pdf.addImage(imageData, 'PNG', 8, yPosition, imageWidth, imageHeight);
  renderedHeight -= pageHeight - 16;

  while (renderedHeight > 0) {
    pdf.addPage();
    yPosition = renderedHeight - imageHeight + 8;
    pdf.addImage(imageData, 'PNG', 8, yPosition, imageWidth, imageHeight);
    renderedHeight -= pageHeight - 16;
  }

  pdf.save(fileName);
}
