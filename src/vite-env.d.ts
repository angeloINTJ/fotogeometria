/// <reference types="vite/client" />

// exifr's mini build, imported by its path (src/io/exif.ts): the package's
// types describe its full build, whose API the mini build shares.
declare module 'exifr/dist/mini.esm.mjs' {
  export { default } from 'exifr';
}
