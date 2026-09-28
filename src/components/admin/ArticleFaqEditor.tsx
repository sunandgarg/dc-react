import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ArticleFaqDraft } from "@/lib/articleFaqs";

type Props = {
  value: ArticleFaqDraft[];
  onChange: (value: ArticleFaqDraft[]) => void;
  allowDeleteSaved?: boolean;
  disabled?: boolean;
};

/** FAQs are part of the article form, never separate database writes. */
export function ArticleFaqEditor({ value, onChange, allowDeleteSaved = false, disabled = false }: Props) {
  const update = (index: number, patch: Partial<ArticleFaqDraft>) =>
    onChange(value.map((faq, i) => i === index ? { ...faq, ...patch } : faq));
  const move = (index: number, direction: number) => {
    const next = [...value];
    [next[index], next[index + direction]] = [next[index + direction], next[index]];
    onChange(next);
  };

  return (
    <div className="space-y-3" aria-label="Article FAQs">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">{value.length} FAQ{value.length === 1 ? "" : "s"}</span>
        <Button type="button" size="sm" variant="outline" disabled={disabled || value.length >= 50}
          onClick={() => onChange([...value, { question: "", answer: "", is_active: true }])}>Add FAQ</Button>
      </div>
      <p className="text-xs text-muted-foreground">Add FAQs now. They save or submit for approval together with this article.</p>
      {value.map((faq, index) => (
        <fieldset key={faq.id || index} disabled={disabled} className="space-y-2 rounded-lg border border-border p-3">
          <legend className="px-1 text-xs font-medium">FAQ {index + 1}</legend>
          <label className="block text-xs" htmlFor={`article-faq-question-${index}`}>Question</label>
          <Input id={`article-faq-question-${index}`} aria-label={`FAQ ${index + 1} question`}
            value={faq.question} maxLength={2000} onChange={(event) => update(index, { question: event.target.value })} />
          <label className="block text-xs" htmlFor={`article-faq-answer-${index}`}>Answer</label>
          <textarea id={`article-faq-answer-${index}`} aria-label={`FAQ ${index + 1} answer`} value={faq.answer}
            maxLength={20000} rows={3} onChange={(event) => update(index, { answer: event.target.value })}
            className="w-full resize-y rounded-lg border border-border bg-card px-3 py-2 text-sm" />
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-1.5 text-xs"><input type="checkbox" checked={faq.is_active !== false}
              onChange={(event) => update(index, { is_active: event.target.checked })} />Show this FAQ</label>
            <Button type="button" size="sm" variant="ghost" aria-label={`Move FAQ ${index + 1} up`} disabled={index === 0}
              onClick={() => move(index, -1)}>Move up</Button>
            <Button type="button" size="sm" variant="ghost" aria-label={`Move FAQ ${index + 1} down`} disabled={index === value.length - 1}
              onClick={() => move(index, 1)}>Move down</Button>
            {(!faq.id || allowDeleteSaved) && <Button type="button" size="sm" variant="ghost" aria-label={`Remove FAQ ${index + 1}`}
              onClick={() => onChange(value.filter((_, i) => i !== index))}>Remove</Button>}
          </div>
        </fieldset>
      ))}
    </div>
  );
}
