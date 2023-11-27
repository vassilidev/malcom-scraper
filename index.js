(async () => {
    const {writeFileSync} = require('fs');
    require('dotenv').config();
    const puppeteer = require('puppeteer');
    const browser = await puppeteer.launch({headless: true, ignoreHTTPSErrors: true});
    const page = await browser.newPage();
    const axios = require('axios');

    let noticesTypes = await axios.get(process.env.BASE_URL + '/api/notices/types').then(result => result.data.noticeType)

    let malcomJson = [];

    for (let notice of Object.values(noticesTypes)) {
        let response = await page.goto(
            process.env.BASE_URL
            + process.env.BASE_QUERY_PATH
            + '/'
            + notice.slug
        );

        if ([500, 404, 403].includes(response.status())) {
            continue;
        }

        await page.waitForNetworkIdle();

        let noticeForm = await page.evaluate(async () => {
            let parent = document.getElementById("form_notice");

            let allChildNodes = parent.querySelectorAll('.form-control')

            let formElements = [];
            let tagNames = ['input', 'textarea', 'select'];

            for (let i = 0; i < allChildNodes.length; i++) {
                const child = allChildNodes[i];

                if (child.nodeType !== Node.ELEMENT_NODE) {
                    continue;
                }

                let tagName = child.tagName.toLowerCase();

                if (!tagNames.includes(tagName)) {
                    continue;
                }

                if (child?.type === 'hidden') {
                    continue;
                }

                formElements.push(child);
            }

            let finalFormElements = [];

            function getType(el) {
                let type;

                if (el.classList.contains('datepicker')) {
                    return 'date';
                }

                let tagName = el.tagName.toLowerCase();

                switch (tagName) {
                    case 'textarea':
                        type = 'input';
                        break
                    case 'select':
                        type = 'select_multiple';
                        break;
                    default:
                        type = tagName
                }

                return type;
            }

            function buildSelect(el) {
                if (el.tagName.toLowerCase() !== 'select') {
                    return;
                }

                return {
                    values: [...el.options].map(o => o.value),
                    options: [...el.options].map(o => o.text),
                    style: {
                        "min_width": "100%"
                    },
                    radio: false,
                    multiple: el.multiple,
                }
            }

            for (let i = 0; i < formElements.length; i++) {
                let child = formElements[i];

                finalFormElements.push({
                    id: (new Date()).getTime(),
                    name: document.querySelector('label[for=' + child.id + ']')?.innerText.replace(' :', '') || child.placeholder,
                    type: getType(child),
                    required: child.required,
                    size: 24,
                    ...buildSelect(child),
                });
            }

            return finalFormElements;
        });

        malcomJson.push({
            form: noticeForm,
            notice,
        });
    }

    writeFileSync(
        './malcom-' + (new Date()).getTime() + '.json',
        JSON.stringify(malcomJson, null, 2)
    );

    await browser.close();

    return malcomJson;
})()