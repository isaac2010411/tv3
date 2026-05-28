import React from 'react';
import { Autocomplete, TextField, InputAdornment } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';

const DEFAULT_SYMBOLS = [
  'BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT',
  'DOGEUSDT', 'ADAUSDT', 'AVAXUSDT', 'MATICUSDT', 'LINKUSDT',
  'LTCUSDT', 'DOTUSDT', 'UNIUSDT', 'ATOMUSDT', 'NEARUSDT',
  'AAVEUSDT', 'APTUSDT', 'ARBUSDT', 'OPUSDT', 'SUIUSDT',
];

/**
 * Symbol selector using MUI Autocomplete.
 * Calls `onChange(symbol)` when the user picks a new symbol.
 */
export default function SymbolSelector({ value, onChange, symbols = DEFAULT_SYMBOLS }) {
  return (
    <Autocomplete
      options={symbols}
      value={value}
      onChange={(_, newValue) => { if (newValue) onChange(newValue); }}
      disableClearable
      sx={{ width: 170 }}
      renderInput={(params) => (
        <TextField
          {...params}
          size="small"
          placeholder="Symbol"
          variant="outlined"
          InputProps={{
            ...params.InputProps,
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
              </InputAdornment>
            ),
            sx: { fontSize: 13, fontWeight: 700 },
          }}
          sx={{
            '& .MuiOutlinedInput-root': { height: 32 },
            '& .MuiInputLabel-root': { display: 'none' },
            '& legend': { display: 'none' },
          }}
        />
      )}
    />
  );
}
