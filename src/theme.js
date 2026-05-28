import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    mode: 'dark',
    background: {
      default: '#0B0F14',
      paper: '#0D1117',
    },
    primary: {
      main: '#3B82F6',
      dark: '#2563EB',
    },
    success: {
      main: '#22C55E',
    },
    error: {
      main: '#EF4444',
    },
    warning: {
      main: '#F59E0B',
    },
    text: {
      primary: '#F1F5F9',
      secondary: '#64748B',
    },
    divider: '#1E293B',
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    fontSize: 13,
    h6: { fontWeight: 700 },
  },
  shape: { borderRadius: 6 },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        'html, body, #root': {
          height: '100%',
          overflow: 'hidden',
        },
        '*::-webkit-scrollbar': { width: 5, height: 5 },
        '*::-webkit-scrollbar-track': { background: 'transparent' },
        '*::-webkit-scrollbar-thumb': {
          background: '#1E293B',
          borderRadius: 3,
          '&:hover': { background: '#334155' },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: '#0D1117',
          border: '1px solid #1E293B',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: { backgroundImage: 'none' },
      },
    },
    MuiCardHeader: {
      styleOverrides: {
        root: { padding: '8px 12px' },
        title: { fontSize: 12, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: '#64748B' },
      },
    },
    MuiCardContent: {
      styleOverrides: {
        root: { padding: '8px 12px', '&:last-child': { paddingBottom: 8 } },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: { textTransform: 'none', minWidth: 0, fontWeight: 500 },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: { borderBottom: '1px solid #1E293B' },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        notchedOutline: { borderColor: '#1E293B' },
        root: { '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#334155' } },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { fontWeight: 600 },
        sizeSmall: { height: 20, fontSize: 10 },
      },
    },
    MuiDivider: {
      styleOverrides: {
        root: { borderColor: '#1E293B' },
      },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: { borderRadius: 3 },
      },
    },
  },
});

export default theme;
