#!/bin/bash
bash -lc '
OUTPUT="docs/reports/code-report/$(printf "code_report_%s.txt" "$(date +%Y%m%d_%H%M%S)")"
mkdir -p "$(dirname "$OUTPUT")"

{
echo "======================================="
echo "PROJECT STRUCTURE + CODE SIZE REPORT"
echo "Generated: $(date)"
echo "======================================="

echo
echo "=== TREE DO PROJETO ==="
tree -a -I "node_modules|dist|build|coverage|.git|.turbo|.next|.solid|.output"

echo
echo "=== CONTAGEM DE LINHAS (.ts / .tsx) ==="

TMP_FILE="$(mktemp)"

find . \
  -type f \
  \( -name "*.ts" -o -name "*.tsx" \) \
  ! -path "*/node_modules/*" \
  ! -path "*/dist/*" \
  ! -path "*/build/*" \
  ! -path "*/coverage/*" \
  ! -path "*/.git/*" \
  ! -path "*/.turbo/*" \
  ! -path "*/.next/*" \
  ! -path "*/.solid/*" \
  ! -path "*/.output/*" \
  -print0 |
while IFS= read -r -d "" file; do
  lines=$(wc -l < "$file")
  printf "%s\t%s\n" "$lines" "$file"
done | sort -rn > "$TMP_FILE"

cat "$TMP_FILE" | awk -F "\t" "
BEGIN {
  total=0; ts=0; tsx=0; count=0;
  print \"Linhas\tArquivo\";
  print \"------\t------\";
}
{
  total += \$1;
  count += 1;
  if (\$2 ~ /\.tsx$/) tsx += \$1;
  else if (\$2 ~ /\.ts$/) ts += \$1;
  print \$1 \"\t\" \$2;
}
END {
  print \"\";
  print \"=== RESUMO ===\";
  print \"Arquivos analisados:\t\" count;
  print \"Total .ts:\t\" ts;
  print \"Total .tsx:\t\" tsx;
  print \"Total geral:\t\" total;
  if (count > 0) print \"Média por arquivo:\t\" int(total / count);
}
"

echo
echo "=== REPORT DE CÓDIGO DESBALANCEADO ==="

awk -F "\t" "
BEGIN { total=0; count=0; }
{ total += \$1; count += 1; rows[count]=\$0; lines[count]=\$1; files[count]=\$2; }
END {
  avg = (count > 0 ? total / count : 0);
  print \"Critérios:\";
  print \"- CRÍTICO: > 800 linhas ou > 3x a média\";
  print \"- ALERTA:  > 500 linhas ou > 2x a média\";
  print \"- OK:      restante\";
  print \"\";
  print \"Status\tLinhas\t% Total\tArquivo\";
  print \"------\t------\t-------\t------\";
  for (i=1; i<=count; i++) {
    pct = (total > 0 ? (lines[i] / total) * 100 : 0);
    status = \"OK\";
    if (lines[i] > 800 || lines[i] > avg * 3) status = \"CRÍTICO\";
    else if (lines[i] > 500 || lines[i] > avg * 2) status = \"ALERTA\";
    printf \"%s\t%d\t%.2f%%\t%s\n\", status, lines[i], pct, files[i];
  }
}
" "$TMP_FILE"

rm -f "$TMP_FILE"

} > "$OUTPUT"

echo "Report salvo em: $OUTPUT"
'