/**
 * Document Parser
 * 支持多种文件格式的内容提取
 */

// 文件类型分类
export type DocumentType =
  | "text"      // 纯文本文件
  | "word"      // Word文档
  | "powerpoint"// PPT
  | "excel"     // Excel
  | "pdf"       // PDF
  | "image"     // 图片
  | "unknown";  // 未知类型

// 根据文件扩展名判断文档类型
export function getDocumentType(filename: string): DocumentType {
  const ext = filename.split(".").pop()?.toLowerCase() || "";

  const typeMap: Record<string, DocumentType> = {
    // 文本文件
    txt: "text",
    md: "text",
    markdown: "text",
    json: "text",
    xml: "text",
    html: "text",
    htm: "text",
    // Word
    doc: "word",
    docx: "word",
    // PowerPoint
    ppt: "powerpoint",
    pptx: "powerpoint",
    // Excel (csv 也作为 excel 类型处理)
    xls: "excel",
    xlsx: "excel",
    xlsm: "excel",
    csv: "excel",
    // PDF
    pdf: "pdf",
    // 图片
    png: "image",
    jpg: "image",
    jpeg: "image",
    gif: "image",
    bmp: "image",
    webp: "image",
    svg: "image",
  };

  return typeMap[ext] || "unknown";
}

// 提取文档内容的接口
export interface ParsedDocument {
  type: DocumentType;
  content: string;      // 文本内容或描述
  metadata: {
    filename: string;
    fileType: string;
    fileSize: number;
    pageCount?: number;  // 页数（PDF/PPT等）
    sheetCount?: number; // 工作表数（Excel）
    imageCount?: number; // 图片数量
    [key: string]: unknown;
  };
  images?: ExtractedImage[]; // 提取的图片列表
}

// 浏览器支持的图片格式
const BROWSER_SUPPORTED_FORMATS = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/gif",
  "image/webp",
  "image/svg+xml",
]);

// 不支持的矢量图格式（需要转换）
const VECTOR_FORMATS = new Set([
  "image/x-emf",
  "image/emf",
  "image/x-wmf",
  "image/wmf",
]);

// 提取的图片信息
export interface ExtractedImage {
  filename: string;     // 图片文件名
  data: Buffer;        // 图片数据
  mimeType: string;     // MIME 类型
  size: number;        // 文件大小
  sourceSlide?: number; // 来源幻灯片编号
  slideText?: string;  // 图片所在幻灯片的文字内容
  // 直接解析的缺陷信息（从 Case Briefing 中提取）
  materials?: string;  // 材料
  claimReason?: string; // 索赔原因
  style?: string;       // 款式
  position?: string;    // 缺陷位置
  defectDescription?: string; // 缺陷描述
  // 图片格式状态（PPT解析时设置）
  isBrowserSupported?: boolean; // 是否被浏览器支持
  isVectorFormat?: boolean; // 是否为矢量图格式（EMF/WMF）
}

/**
 * 从幻灯片文本中解析 Case Briefing 信息
 * 支持多种格式变体：
 * - Case Briefing / case briefing / CASE BRIEFING
 * - Materials / Material / 材料
 * - Claim reasons / Claim reason / 索赔原因
 * - Defect Description / Defect / 缺陷描述
 */
export function parseCaseBriefingFromSlideText(slideText: string) {
  const result: {
    materials?: string;
    claimReason?: string;
    style?: string;
    position?: string;
    defectDescription?: string;
  } = {};

  if (!slideText || slideText.trim() === "") {
    return result;
  }

  // 清理文本
  const cleanText = slideText
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .trim();

  // 通用的字段提取函数
  // 支持多种模式：Field: value, Field：value, Field=value, Field：value 等
  const extractField = (patterns: RegExp[], text: string): string | undefined => {
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        const value = match[1].trim();
        if (value && value.length > 0) {
          return value;
        }
      }
    }
    return undefined;
  };

  // 解析 Materials（支持多种写法）
  result.materials = extractField([
    /Materials?:\s*(.+?)(?=\n[\w\u4e00-\u9fa5]+?:\s*|$)/is,
    /Material\s*:?\s*(.+?)(?=\n[\w\u4e00-\u9fa5]+?:\s*|$)/is,
    /材料[材质]?\s*[:：]?\s*(.+?)(?=\n[\w\u4e00-\u9fa5]+?:\s*|$)/is,
    /Fabric\s*:?\s*(.+?)(?=\n[\w\u4e00-\u9fa5]+?:\s*|$)/is,
  ], cleanText);

  // 解析 Claim reasons（支持多种写法）
  result.claimReason = extractField([
    /Claim\s+reasons?\s*:?\s*(.+?)(?=\n[\w\u4e00-\u9fa5]+?:\s*|$)/is,
    /索赔原因\s*[:：]?\s*(.+?)(?=\n[\w\u4e00-\u9fa5]+?:\s*|$)/is,
    /缺陷类型\s*[:：]?\s*(.+?)(?=\n[\w\u4e00-\u9fa5]+?:\s*|$)/is,
    /Issue\s*:?\s*(.+?)(?=\n[\w\u4e00-\u9fa5]+?:\s*|$)/is,
  ], cleanText);

  // 解析 Style（如果有）
  result.style = extractField([
    /Style?\s*:?\s*(.+?)(?=\n[\w\u4e00-\u9fa5]+?:\s*|$)/is,
    /款式\s*[:：]?\s*(.+?)(?=\n[\w\u4e00-\u9fa5]+?:\s*|$)/is,
    /Product\s*:?\s*(.+?)(?=\n[\w\u4e00-\u9fa5]+?:\s*|$)/is,
    /Garment\s*:?\s*(.+?)(?=\n[\w\u4e00-\u9fa5]+?:\s*|$)/is,
  ], cleanText);

  // 解析 Position（如果有）
  result.position = extractField([
    /Position?s?\s*:?\s*(.+?)(?=\n[\w\u4e00-\u9fa5]+?:\s*|$)/is,
    /位置\s*[:：]?\s*(.+?)(?=\n[\w\u4e00-\u9fa5]+?:\s*|$)/is,
    /Location\s*:?\s*(.+?)(?=\n[\w\u4e00-\u9fa5]+?:\s*|$)/is,
  ], cleanText);

  // 解析 Defect Description（如果有）
  result.defectDescription = extractField([
    /Defect\s+Description?\s*:?\s*(.+?)(?=\n[\w\u4e00-\u9fa5]+?:\s*|$)/is,
    /缺陷描述\s*[:：]?\s*(.+?)(?=\n[\w\u4e00-\u9fa5]+?:\s*|$)/is,
    /Description\s*:?\s*(.+?)(?=\n[\w\u4e00-\u9fa5]+?:\s*|$)/is,
    /问题描述\s*[:：]?\s*(.+?)(?=\n[\w\u4e00-\u9fa5]+?:\s*|$)/is,
    /Details?\s*:?\s*(.+?)(?=\n[\w\u4e00-\u9fa5]+?:\s*|$)/is,
  ], cleanText);

  // 如果没有匹配到任何字段，尝试智能提取
  // 查找包含关键词的整行文本
  if (!result.materials && !result.claimReason && !result.defectDescription) {
    const lines = cleanText.split("\n");
    
    // 查找包含缺陷相关关键词的行
    const defectKeywords = ['defect', 'claim', 'issue', 'problem', 'error', 'damage', 
                           '缺陷', '问题', '索赔', '破损', '色差', '抽丝', '波浪'];
    
    for (const line of lines) {
      const lowerLine = line.toLowerCase();
      
      // 如果行包含材料相关关键词
      if (!result.materials && /(polyamide|nylon|cotton|polyester|spandex|elastane|material|fabric|面料|材料)/i.test(line)) {
        result.materials = line.replace(/^.*?[:：]\s*/, '').trim();
      }
      
      // 如果行包含缺陷/索赔相关关键词
      if (!result.claimReason && defectKeywords.some(kw => lowerLine.includes(kw))) {
        // 提取冒号后的内容，或者整行
        const match = line.match(/(?:^|\s)(.+)$/);
        if (match) {
          result.claimReason = match[1].trim();
        }
      }
    }
  }

  return result;
}

/**
 * 解析文档内容
 * 注意：实际项目中需要安装相应的解析库
 * 如：mammoth (Word), pdf-parse (PDF), xlsx (Excel), sharp (图片) 等
 */
export async function parseDocument(
  fileBuffer: Buffer,
  filename: string,
  fileSize: number
): Promise<ParsedDocument> {
  const docType = getDocumentType(filename);
  const baseMetadata = {
    filename,
    fileType: docType,
    fileSize,
  };

  switch (docType) {
    case "text":
      return parseTextDocument(fileBuffer, baseMetadata);

    case "word":
      return parseWordDocument(fileBuffer, baseMetadata);

    case "powerpoint":
      return parsePowerPointDocument(fileBuffer, baseMetadata);

    case "excel":
      return parseExcelDocument(fileBuffer, baseMetadata);

    case "pdf":
      return parsePdfDocument(fileBuffer, baseMetadata);

    case "image":
      return parseImageDocument(fileBuffer, baseMetadata);

    default:
      // 未知类型，尝试作为文本读取
      try {
        const content = fileBuffer.toString("utf-8");
        return {
          type: "text",
          content: `文件名: ${filename}\n文件大小: ${fileSize} bytes\n\n内容:\n${content}`,
          metadata: baseMetadata,
        };
      } catch {
        return {
          type: "unknown",
          content: `文件名: ${filename}\n文件大小: ${fileSize} bytes\n\n[无法解析此文件类型的内容，文件已上传至存储]`,
          metadata: baseMetadata,
        };
      }
  }
}

// 解析文本文件
async function parseTextDocument(
  fileBuffer: Buffer,
  metadata: ParsedDocument["metadata"]
): Promise<ParsedDocument> {
  const content = fileBuffer.toString("utf-8");
  return {
    type: "text",
    content: `文件名: ${metadata.filename}\n\n内容:\n${content}`,
    metadata,
  };
}

// 解析 Word 文档
async function parseWordDocument(
  fileBuffer: Buffer,
  metadata: ParsedDocument["metadata"]
): Promise<ParsedDocument> {
  // 注意：需要安装 mammoth 库
  // npm install mammoth
  try {
    // 动态导入，避免未安装时报错
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer: fileBuffer });

    return {
      type: "word",
      content: `文件名: ${metadata.filename}\n文件类型: Word文档\n\n提取的文本内容:\n${result.value}`,
      metadata: {
        ...metadata,
        pageCount: undefined, // mammoth 不提供页数
      },
    };
  } catch {
    // 如果 mammoth 未安装，返回提示信息
    return {
      type: "word",
      content: `文件名: ${metadata.filename}\n文件类型: Word文档\n文件大小: ${metadata.fileSize} bytes\n\n[Word文档已上传，但缺少解析库。请安装 mammoth: pnpm add mammoth]`,
      metadata,
    };
  }
}

// 解析 PowerPoint 文档
async function parsePowerPointDocument(
  fileBuffer: Buffer,
  metadata: ParsedDocument["metadata"]
): Promise<ParsedDocument> {
  try {
    const JSZip = await import("jszip");
    const zip = await JSZip.default.loadAsync(fileBuffer);

    let slideCount = 0;
    const slideTextMap: Map<number, string> = new Map();
    const imageList: Array<{ path: string; data: Buffer; mimeType: string; size: number }> = [];

    // 收集所有幻灯片文本
    const slidePromises: Promise<void>[] = [];
    zip.forEach((relativePath, file) => {
      // 处理 slide 文件 - 提取文本
      if (relativePath.match(/ppt\/slides\/slide\d+\.xml$/)) {
        slideCount++;
        const slideNum = parseInt(relativePath.match(/slide(\d+)\.xml$/)?.[1] || "0");
        const promise = file.async("text").then((content) => {
          const textMatches = content.match(/<a:t>([^<]*)<\/a:t>/g);
          if (textMatches) {
            const slideTexts = textMatches
              .map((match: string) => match.replace(/<\/?a:t>/g, ""))
              .filter((text: string) => text.trim());
            if (slideTexts.length > 0) {
              slideTextMap.set(slideNum, slideTexts.join("\n"));
            }
          }
        });
        slidePromises.push(promise);
      }

      // 收集所有图片
      if (relativePath.match(/ppt\/media\/image/)) {
        const ext = relativePath.split(".").pop()?.toLowerCase() || "";
        const mimeTypes: Record<string, string> = {
          png: "image/png",
          jpg: "image/jpeg",
          jpeg: "image/jpeg",
          gif: "image/gif",
          bmp: "image/bmp",
          webp: "image/webp",
          svg: "image/svg+xml",
          emf: "image/x-emf",
          tif: "image/tiff",
          tiff: "image/tiff",
        };
        const mimeType = mimeTypes[ext] || `image/${ext}`;

        const promise = file.async("arraybuffer").then((data) => {
          imageList.push({
            path: relativePath,
            data: Buffer.from(data),
            mimeType,
            size: data.byteLength,
          });
        });
        slidePromises.push(promise);
      }
    });

    await Promise.all(slidePromises);

    // 从幻灯片关系文件中获取图片到幻灯片的映射
    const imageToSlideMap: Map<string, number> = new Map();
    zip.forEach((relativePath) => {
      if (relativePath.match(/ppt\/slides\/slide\d+\.xml\.rels$/)) {
        const slideNum = parseInt(relativePath.match(/slide(\d+)\.xml\.rels$/)?.[1] || "0");
        const relsContent = zip.file(relativePath);
        if (relsContent) {
          relsContent.async("text").then((content) => {
            const matches = content.matchAll(/Target="([^"]*image[^"]*)"/gi);
            for (const match of matches) {
              const imagePath = match[1].replace(/^\.\.\/media\//, "ppt/media/");
              imageToSlideMap.set(imagePath, slideNum);
            }
          });
        }
      }
    });

    // 等待关系文件解析完成
    await new Promise((resolve) => setTimeout(resolve, 100));

    // 构建幻灯片编号到文本的映射（用于无关联图片的默认文本）
    const allSlideTexts: string[] = [];
    slideTextMap.forEach((text, num) => {
      allSlideTexts.push(`--- 第 ${num} 页 ---\n${text}`);
    });

    // 构建图片列表，带幻灯片关联
    const extractedImages: ExtractedImage[] = imageList.map((img, index) => {
      // 尝试从路径中提取幻灯片编号
      const slideMatch = img.path.match(/slide(\d+)/);
      let sourceSlide = slideMatch ? parseInt(slideMatch[1]) : undefined;

      // 如果路径中没有，尝试从关系映射中获取
      if (sourceSlide === undefined) {
        sourceSlide = imageToSlideMap.get(img.path);
      }

      // 获取该幻灯片的文本
      const slideText = sourceSlide ? slideTextMap.get(sourceSlide) : undefined;

      // 直接解析 Case Briefing 信息（根据您提供的格式）
      let caseInfo: any = {};
      if (slideText) {
        caseInfo = parseCaseBriefingFromSlideText(slideText);
      }

      // 构建描述性文件名
      const slideInfo = sourceSlide ? `_slide${sourceSlide}` : "";
      const filename = `image_${index + 1}${slideInfo}.${img.path.split(".").pop()}`;

      // 检查图片格式是否受浏览器支持
      const isBrowserSupported = BROWSER_SUPPORTED_FORMATS.has(img.mimeType);
      const isVectorFormat = VECTOR_FORMATS.has(img.mimeType);

      return {
        filename,
        data: img.data,
        mimeType: img.mimeType,
        size: img.size,
        sourceSlide,
        slideText: slideText || "",
        materials: caseInfo.materials,
        claimReason: caseInfo.claimReason,
        style: caseInfo.style,
        position: caseInfo.position,
        defectDescription: caseInfo.defectDescription,
        // 标记图片格式状态
        isBrowserSupported,
        isVectorFormat,
      };
    });

    // 分离支持和不支持的图片
    const supportedImages = extractedImages.filter(img => img.isBrowserSupported);
    const unsupportedImages = extractedImages.filter(img => !img.isBrowserSupported);

    // 记录不支持的图片格式（用于调试）
    if (unsupportedImages.length > 0) {
      console.log(`[PPT Parser] 跳过 ${unsupportedImages.length} 个不支持的矢量图 (EMF/WMF)`);
      console.log(`[PPT Parser] 保留 ${supportedImages.length} 个浏览器兼容图片 (PNG/JPG等)`);
    }

    // 按幻灯片编号排序图片（只保留支持的格式）
    supportedImages.sort((a, b) => (a.sourceSlide || 0) - (b.sourceSlide || 0));

    const extractedText = allSlideTexts.join("\n\n") || "[未能从PPT中提取到文本内容]";

    return {
      type: "powerpoint",
      content: `文件名: ${metadata.filename}\n文件类型: PowerPoint演示文稿\n页数: ${slideCount}\n图片数量: ${extractedImages.length} (其中 ${supportedImages.length} 个可显示)\n\n提取的文本内容:\n${extractedText}`,
      metadata: {
        ...metadata,
        pageCount: slideCount,
        imageCount: supportedImages.length, // 只统计可显示的图片
        totalImageCount: extractedImages.length, // 总图片数
        unsupportedImageCount: unsupportedImages.length, // 不支持的图片数
      },
      images: supportedImages.length > 0 ? supportedImages : undefined,
    };
  } catch {
    return {
      type: "powerpoint",
      content: `文件名: ${metadata.filename}\n文件类型: PowerPoint演示文稿\n文件大小: ${metadata.fileSize} bytes\n\n[PPT文件已上传，但解析失败。请安装 jszip: pnpm add jszip]`,
      metadata,
    };
  }
}

// 解析 Excel 文档
async function parseExcelDocument(
  fileBuffer: Buffer,
  metadata: ParsedDocument["metadata"]
): Promise<ParsedDocument> {
  // 注意：需要安装 xlsx 库
  // npm install xlsx
  try {
    const xlsx = await import("xlsx");
    const workbook = xlsx.read(fileBuffer, { type: "buffer" });

    let content = `文件名: ${metadata.filename}\n文件类型: Excel表格\n工作表数量: ${workbook.SheetNames.length}\n\n`;

    // 提取每个工作表的内容
    for (const sheetName of workbook.SheetNames) {
      const worksheet = workbook.Sheets[sheetName];
      const data = xlsx.utils.sheet_to_csv(worksheet);
      content += `--- 工作表: ${sheetName} ---\n${data}\n\n`;
    }

    return {
      type: "excel",
      content,
      metadata: {
        ...metadata,
        sheetCount: workbook.SheetNames.length,
      },
    };
  } catch {
    return {
      type: "excel",
      content: `文件名: ${metadata.filename}\n文件类型: Excel表格\n文件大小: ${metadata.fileSize} bytes\n\n[Excel文件已上传，但缺少解析库。请安装 xlsx: pnpm add xlsx]`,
      metadata,
    };
  }
}

// 解析 PDF 文档
async function parsePdfDocument(
  fileBuffer: Buffer,
  metadata: ParsedDocument["metadata"]
): Promise<ParsedDocument> {
  // 注意：需要安装 pdf-parse 库
  // npm install pdf-parse
  try {
    const pdfParse = await import("pdf-parse");
    const result = await pdfParse.default(fileBuffer);

    return {
      type: "pdf",
      content: `文件名: ${metadata.filename}\n文件类型: PDF文档\n页数: ${result.numpages}\n\n提取的文本内容:\n${result.text}`,
      metadata: {
        ...metadata,
        pageCount: result.numpages,
      },
    };
  } catch {
    return {
      type: "pdf",
      content: `文件名: ${metadata.filename}\n文件类型: PDF文档\n文件大小: ${metadata.fileSize} bytes\n\n[PDF文件已上传，但缺少解析库。请安装 pdf-parse: pnpm add pdf-parse]`,
      metadata,
    };
  }
}

// 解析图片文件
async function parseImageDocument(
  fileBuffer: Buffer,
  metadata: ParsedDocument["metadata"]
): Promise<ParsedDocument> {
  // 图片文件无法直接提取文本，返回文件信息
  // 如果需要OCR，可以集成 OCR 服务
  return {
    type: "image",
    content: `文件名: ${metadata.filename}\n文件类型: 图片\n文件大小: ${metadata.fileSize} bytes\n\n[图片文件已上传。如需OCR文字识别，请集成OCR服务]`,
    metadata,
  };
}

/**
 * 检查是否需要安装额外的解析库
 */
export function getRequiredParsers(): { name: string; package: string; types: DocumentType[] }[] {
  return [
    { name: "Word解析", package: "mammoth", types: ["word"] },
    { name: "Excel解析", package: "xlsx", types: ["excel"] },
    { name: "PDF解析", package: "pdf-parse", types: ["pdf"] },
  ];
}
