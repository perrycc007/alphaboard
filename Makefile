.PHONY: review-api review-ui

review-api:
	py -3 "./python setup detector/serve_review.py"

review-ui:
	cd review-studio && npm.cmd run dev
