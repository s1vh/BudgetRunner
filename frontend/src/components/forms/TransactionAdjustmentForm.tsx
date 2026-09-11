import { useState, type FormEvent } from 'react'
import { Undo2 } from 'lucide-react'
import { Button, Field, Input, Textarea } from '@/components/ui/primitives'
import { useI18n } from '@/i18n/I18nContext'
import type { TransactionAdjustmentDraft } from '@/types/domain'

function dateTimeInputValue(date: Date) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
}

interface TransactionAdjustmentFormProps {
  onSubmit: (draft: TransactionAdjustmentDraft) => Promise<void>
  onCancel: () => void
}

export function TransactionAdjustmentForm({ onSubmit, onCancel }: TransactionAdjustmentFormProps) {
  const { t } = useI18n()
  const [reason, setReason] = useState('')
  const [occurredAt, setOccurredAt] = useState(() => dateTimeInputValue(new Date()))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    const parsedDate = new Date(occurredAt)
    const nextErrors: Record<string, string> = {}
    if (reason.trim().length < 3) nextErrors.reason = t('transactions.adjustmentReasonError')
    if (!occurredAt || Number.isNaN(parsedDate.getTime())) nextErrors.occurredAt = t('transactions.adjustmentDateError')
    else if (parsedDate.getTime() > Date.now()) nextErrors.occurredAt = t('transactions.adjustmentFutureError')
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) return

    setSubmitting(true)
    setSubmitError(null)
    try {
      await onSubmit({ reason: reason.trim(), occurredAt: parsedDate.toISOString() })
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : t('error.requestFailed'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className="grid gap-5" onSubmit={submit} noValidate>
      <Field label={t('transactions.adjustmentReason')} htmlFor="adjustment-reason" error={errors.reason} required>
        <Textarea
          id="adjustment-reason"
          rows={4}
          maxLength={500}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder={t('transactions.adjustmentReasonPlaceholder')}
          aria-invalid={Boolean(errors.reason)}
        />
      </Field>
      <Field label={t('transactions.adjustmentDate')} htmlFor="adjustment-date" error={errors.occurredAt} required>
        <Input
          id="adjustment-date"
          type="datetime-local"
          max={dateTimeInputValue(new Date())}
          value={occurredAt}
          onChange={(event) => setOccurredAt(event.target.value)}
          aria-invalid={Boolean(errors.occurredAt)}
        />
      </Field>
      <p className="rounded-lg border border-sunset/25 bg-sunset/5 p-3 text-xs leading-5 text-sunset">{t('transactions.adjustmentNote')}</p>
      {submitError && <p className="rounded-lg border border-neon-magenta/25 bg-neon-magenta/5 p-3 text-sm text-neon-magenta" role="alert">{submitError}</p>}
      <div className="flex flex-col-reverse gap-3 border-t border-outline-soft/60 pt-5 sm:flex-row sm:justify-end">
        <Button type="button" variant="ghost" onClick={onCancel}>{t('common.cancel')}</Button>
        <Button type="submit" variant="purple" icon={Undo2} loading={submitting}>{t('transactions.createAdjustment')}</Button>
      </div>
    </form>
  )
}
