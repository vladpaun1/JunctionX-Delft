# The challenge

Speech and voice technology is increasingly used, e.g., in emergency response centers, domestic voice assistants, and search engines. Because of the paramount relevance spoken language plays in our lives, it is critical that speech technology systems are able to
deal with the variability in the way people speak (e.g., due to speaker differences, demographics, different speaking styles, and differently abled users). A big issue is finding speech data to train the deep-learning-based speech systems: existing data is scarce. Potentially, freely available data could be used; however, these need to be carefully checked for extremist views as we should avoid using questionable data that could perpetuate bias and extremist views. We are excited to challenge you to create a system to automatically screen audio (and video) for extremist views as a key step to alleviating freely available speech data for the development of inclusive speech technology.

To use freely available speech data for training inclusive speech technology they need to be screened for extremist views and bad language to avoid potentially perpetuating these extremist views and bias into our systems. How can this be done? The actual challenge is not making (e.g., coding) the system, it is its design. You need to carefully define what constitutes “extreme views” or “bad language”, your definition needs to be made responsibly. Think of the implications your definition (and its implementation in the form of a system or solution you will provide) can have on society, think of the ethical, social and legal responsibilities it implies.

# Extreme Speech Filter — Backend

## Quick start
make a .env file in the root dir, and input this information:
```.env
DEBUG=1
SECRET_KEY=<"key">
ALLOWED_HOSTS=localhost,127.0.0.1
CSRF_TRUSTED_ORIGINS=http://localhost:8000
VOSK_MODEL_DIR=
```
make sure docker and docker compose are installed
to build the docker image:
```bash
docker compose up --build
```
then every time you want to run the server:
```bash
docker compose up
```

## other actions
make sure you have all the python dev tools and are in your venv:
```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements/dev.txt
```
to migrate the database:
```bash
python backend/manage.py migrate
```
to get all the data in the unified dataset:
```bash
python datasets/final_conversion.py
```
to train the models:
```bash
python -m backend.services.label.training.svm_train \
  --data datasets/final/unified_dataset.csv \
  --out backend/services/label/model/artifacts
python -m backend.services.label.training.rf_train \
  --data datasets/final/unified_dataset.csv \
  --out backend/services/label/model/artifacts
python -m backend.services.label.training.lr_train \
  --data datasets/final/unified_dataset.csv \
  --out backend/services/label/model/artifacts
```

# Bibliography

cjadams, Jeffrey Sorensen, Julia Elliott, Lucas Dixon, Mark McDonald, nithum, & Will Cukierski. (2017). Toxic Comment Classification Challenge. .

Costa-jussà, M., Meglioli, M., Andrews, P., Dale, D., Hansanti, P., Kalbassi, E., Mourachko, A., Ropers, C., & Wood, C. (2024). MuTox: Universal MUltilingual Audio-based TOXicity Dataset and Zero-shot Detector. In L.-W. Ku, A. Martins, & V. Srikumar (Eds.), Findings of the Association for Computational Linguistics: ACL 2024 (pp. 5725–5734). Association for Computational Linguistics. https://doi.org/10.18653/v1/2024.findings-acl.34

Davidson, T., Warmsley, D., Macy, M., & Weber, I. (2017). Automated Hate Speech Detection and the Problem of Offensive Language. In Proceedings of the 11th International AAAI Conference on Web and Social Media (pp. 512-515).

Gibert, O., Perez, N., Garc\ia-Pablos, A., & Cuadros, M. (2018). Hate Speech Dataset from a White Supremacy Forum. In Proceedings of the 2nd Workshop on Abusive Language Online (ALW2) (pp. 11–20). Association for Computational Linguistics.

Kennedy, B., Atari, M., Davani, A. M., Yeh, L., Omrani, A., Kim, Y., Coombs, K., Havaldar, S., Portillo-Wightman, G., Gonzalez, E., Hoover, J., Azatian, A., Hussain, A., Lara, A., Cardenas, G., Omary, A., Park, C., Wang, X., Wijaya, C., Zhang, Y., Meyerowitz, B., & Dehghani, M. (2022). Introducing the Gab Hate Corpus: defining and applying hate-based rhetoric to social media posts at scale. Language Resources and Evaluation, 56(1), 79–108. https://doi.org/10.1007/s10579-021-09569-x
