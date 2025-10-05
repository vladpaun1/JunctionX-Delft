# The challenge

Speech and voice technology is increasingly used, e.g., in emergency response centers, domestic voice assistants, and search engines. Because of the paramount relevance spoken language plays in our lives, it is critical that speech technology systems are able to
deal with the variability in the way people speak (e.g., due to speaker differences, demographics, different speaking styles, and differently abled users). A big issue is finding speech data to train the deep-learning-based speech systems: existing data is scarce. Potentially, freely available data could be used; however, these need to be carefully checked for extremist views as we should avoid using questionable data that could perpetuate bias and extremist views. We are excited to challenge you to create a system to automatically screen audio (and video) for extremist views as a key step to alleviating freely available speech data for the development of inclusive speech technology.

To use freely available speech data for training inclusive speech technology they need to be screened for extremist views and bad language to avoid potentially perpetuating these extremist views and bias into our systems. How can this be done? The actual challenge is not making (e.g., coding) the system, it is its design. You need to carefully define what constitutes “extreme views” or “bad language”, your definition needs to be made responsibly. Think of the implications your definition (and its implementation in the form of a system or solution you will provide) can have on society, think of the ethical, social and legal responsibilities it implies.

# Extreme Speech Filter — Backend

## Quick start
```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements/dev.txt
python backend/manage.py migrate
python backend/manage.py runserver 0.0.0.0:8000
```
Test: ```GET /api/ping/``` → ```{"status":"ok","service":"backend"}```

