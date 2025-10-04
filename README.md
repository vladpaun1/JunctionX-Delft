# Extreme Speech Filter — Backend

## Quick start
```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements/dev.txt
cd backend
python manage.py migrate
python manage.py runserver 0.0.0.0:8000
```
Test: ```GET /api/ping/``` → ```{"status":"ok","service":"backend"}```










# The challenge

Speech and voice technology is increasingly used, e.g., in emergency response centers, domestic voice assistants, and search engines. Because of the paramount relevance spoken language plays in our lives, it is critical that speech technology systems are able to
deal with the variability in the way people speak (e.g., due to speaker differences, demographics, different speaking styles, and differently abled users). A big issue is finding speech data to train the deep-learning-based speech systems: existing data is scarce. Potentially, freely available data could be used; however, these need to be carefully checked for extremist views as we should avoid using questionable data that could perpetuate bias and extremist views. We are excited to challenge you to create a system to automatically screen audio (and video) for extremist views as a key step to alleviating freely available speech data for the development of inclusive speech technology.

To use freely available speech data for training inclusive speech technology they need to be screened for extremist views and bad language to avoid potentially perpetuating these extremist views and bias into our systems. How can this be done? The actual challenge is not making (e.g., coding) the system, it is its design. You need to carefully define what constitutes “extreme views” or “bad language”, your definition needs to be made responsibly. Think of the implications your definition (and its implementation in the form of a system or solution you will provide) can have on society, think of the ethical, social and legal responsibilities it implies.

# Insights

Responsibly determine what constitutes an extreme view and/or bad language, and make, build, or code a system that automatically finds these within large datasets of audio (and/or video) and provide the timestamps of the identified speech stretches in an efficient and fast manner. Ideally, in a user-friendly way. The speech can be audio-only or the audio part of video and needs to be in English.

# What we'll bring

During the event, participants will be creating an innovative approach to screen large amounts of audio data for extremist views and bad language. We will provide pointers to a reference dataset to be used as test dataset, and guidelines for participants to find suitable datasets they can work with. At 12hrs after the start of the hackathon you will receive an automatic message with the link to the test dataset, such that you can show us that your system works on the data we have picked up to test your system.

# The Prizes

The prize is a collaboration with the DISC lab at TUDelft, to e.g., turn the concepts/systems into an academic publication, or to further develop the system.

# Judging criteria

To win carefully consider the following aspects:
1. The more refined, robust, and responsible your definition of “extremist view / bad language”, the more points you will get. You are encouraged to provide in written (briefly) your reasoning on why you believe your definition fulfills these aspects.
2. Your solution can be made in a system implemented in any way. It might be a webbased solution (e.g., a website), it might be a client-server solution, or even a local (client-only) solution, and e.g., be given in the form of a mobile or desktop app.
3. The proposed solution needs to be of own authorship; any suspicion of plagiarism in any form can result in disqualification. Remember: reusing code, software, or tools with a proper license and properly referring and citing your sources is not plagiarism.
4. At a minimum the proposed system or solution needs to be able to indicate whether there are extremist views in the audio/video. Additional points will be given if the system is able to provide timestamps in the audio, and if it is fast and efficient. Additional points are given if your solution is readily available as a free to use, privacy preserving, open, and easily deployable system: e.g., a free and open- source server-client solution; say an Android app that connects to (a free and opensource) server, without using any proprietary frameworks.
5. Participants are allowed to work with our reference datasets or with their own datasets, e.g., from the Internet to, e.g., train your system. However 12 hrs after the start of the hackathon you will receive a link with the test dataset to show how your system works on the data we have picked up to test your system.
6. Participants are only allowed to use data that has a suitable copyright license for the hackathon. It is not allowed to infringe any copyright rules, laws, or regulations (including privacy) in any jurisdiction in acquiring, using or reusing the data, nor in the use of any tools or means for making the system.

# About the company

The Delft Inclusive Speech Communication (DISC) lab at TU Delft is an internationally
renowned lab focusing on developing inclusive speech technology, i.e., speech technology
for everyone, irrespective of a speaker’s voice, language, and the way they speak. The lab
focuses on investigating and mitigating bias in speech technology, with a focus on
automatic speech recognition (ASR; speech-to-text). We are excited to work with the
winner of the challenge to further develop their solution for distribution to the speech
technology field.
