import { CompiledStateGraph } from '@langchain/langgraph';
import sharp from 'sharp';

export default async function exportGraphPNG(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  graph: CompiledStateGraph<any, any, any, any, any, any, any>
) {
  const drawableGraph = await graph.getGraphAsync();
  const jpegImage = await drawableGraph.drawMermaidPng(); // this is a lie - it is actually a JPEG image
  const jpegBuffer = await jpegImage.arrayBuffer();
  const pngBuffer = await sharp(jpegBuffer).png().toBuffer();
  return pngBuffer;
}
