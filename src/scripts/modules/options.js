/*
*  Color options (applied on the map and on the chart):
*/
export const color_countries = 'rgb(147, 144, 252)'; // Color for features within the study zone but not highlighted
export const color_disabled = '#bebecd'; // Color for features outside the study zone / without data
export const color_sup = 'green'; // Color for selected feature with "better" values than the reference feature
export const color_inf = 'red'; // Color for selected feature with "worse" values than the reference feature
export const color_highlight = 'yellow'; // Color for the reference feature ("Ma région")
export const color_default_dissim = 'darkred'; // Neutral color for selected features when green/red can't be used

/*
* Options regarding the formatting of numbers as string
*
*/
export const formatnb_decimal_sep = ',';
export const formatnb_thousands_sep = ' ';

/*
*  Misc. options:
*/
// The maximum number of variables that can be selected simultaneously:
export const MAX_VARIABLES = 7;
// xxx:
export const RATIO_WH_MAP = 0.879;
