export interface ColorToken {
    label: string;
    base: string;
    hover: string;
}

/**
 * Primary color palette for the Component Designer.
 * Each token carries a base swatch color and a matching hover color.
 */
export const PRIMARY_COLORS: ColorToken[] = [
    { label: 'Grey 100',   base: '#161616', hover: '#262626' },
    { label: 'Grey 70',    base: '#525252', hover: '#6f6f6f' },
    { label: 'Teal 70',    base: '#005D5D', hover: '#007070' },
    { label: 'Cyan 70',    base: '#00539A', hover: '#0066BD' },
    { label: 'Purple 70',  base: '#6929C4', hover: '#7C3DD6' },
    { label: 'Magenta 70', base: '#9F1853', hover: '#BF1D63' },
    { label: 'Blue 70',    base: '#0043CE', hover: '#0053FF' },
];
