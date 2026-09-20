import { ChangeEvent, useRef } from 'react'
import DownloadIcon from '@mui/icons-material/Download'
import RestoreIcon from '@mui/icons-material/Restore'
import { createUseStyles } from 'react-jss'
import { Button, Row } from '@/components/ui'
import { tokens } from '@/theme/tokens'

const useStyles = createUseStyles({
  hidden: { display: 'none' },
  help: { color: tokens.color.textMuted, fontSize: tokens.font.sizeXs },
})

export function BackupControls({ onExport, onImport }: { onExport: () => void; onImport: (file: File) => void }) {
  const classes = useStyles()
  const inputRef = useRef<HTMLInputElement>(null)
  const importFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) onImport(file)
    event.target.value = ''
  }
  return (
    <>
      <Row>
        <Button onClick={onExport}>
          <DownloadIcon fontSize="small" /> Download backup
        </Button>
        <Button onClick={() => inputRef.current?.click()}>
          <RestoreIcon fontSize="small" /> Restore backup
        </Button>
      </Row>
      <input ref={inputRef} className={classes.hidden} type="file" accept="application/json" onChange={importFile} />
      <span className={classes.help}>Restoring a backup replaces the Firebase data for this account after confirmation.</span>
    </>
  )
}
