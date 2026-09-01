export interface ExifRawTag {
  id?: number | string;
  name: string;
  value: any;
  rawValue?: any;
  format?: string;
  section?: string;
  description?: string;
}

export interface ExifOverview {
  make?: string;
  model?: string;
  lensModel?: string;
  focalLength?: number;
  focalLengthIn35mm?: number;
  fNumber?: number;
  exposureTime?: number;
  exposureTimeString?: string;
  iso?: number;
  exposureCompensation?: number;
  exposureProgram?: string;
  meteringMode?: string;
  whiteBalance?: string;
  flash?: string;
  dateTimeOriginal?: string;
  imageWidth?: number;
  imageHeight?: number;
  colorSpace?: string;
  software?: string;
  artist?: string;
  copyright?: string;
  gpsLatitude?: number;
  gpsLongitude?: number;
  gpsAltitude?: number;
  sensorFormatEstimate?: string;
  megapixels?: number;
}

export interface ParsedExifResult {
  hasExif: boolean;
  overview: ExifOverview;
  rawTags: ExifRawTag[];
  sections: {
    name: string;
    label: string;
    tags: ExifRawTag[];
  }[];
  rawJsonString: string;
  fullDataMap: Record<string, any>;
}
