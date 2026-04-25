.PHONY: review-api review-ui review-start

review-api:
	"C:\Users\perry\anaconda3\python.exe" "C:\Users\perry\Desktop\Alphaboard\python setup detector\serve_review.py"

review-ui:
	cd review-studio && npm.cmd run dev -- --host 127.0.0.1 --port 4174

review-start:
	powershell -NoProfile -ExecutionPolicy Bypass -File ".\scripts\start-review-studio.ps1"
