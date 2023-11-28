(async () => {
    const {writeFileSync} = require('fs');
    require('dotenv').config();
    const puppeteer = require('puppeteer');
    const browser = await puppeteer.launch({headless: true, ignoreHTTPSErrors: true});
    const page = await browser.newPage();
    const axios = require('axios');

    let noticesTypes = await axios.get(process.env.BASE_URL + '/api/notices/types').then(result => result.data.noticeType)

    let malcomJson = [];

    console.log("Found " + Object.keys(noticesTypes).length + " notices")

    for (let notice of Object.values(noticesTypes)) {
        let url = process.env.BASE_URL
            + process.env.BASE_QUERY_PATH
            + '/'
            + notice.slug;

        console.log("going to " + url);

        let response = await page.goto(url);

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

            function uuidv4() {
                return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, c =>
                    (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
                );
            }

            for (let i = 0; i < formElements.length; i++) {
                let child = formElements[i];
                let label = document.querySelector('label[for=' + child.id + ']');

                finalFormElements.push({
                    id: uuidv4(),
                    name: label?.innerText.replace(' :', '') || child.placeholder || uuidv4(),
                    type: getType(child),
                    domId: child.id,
                    domName: child.name,
                    required: child.required,
                    ...buildSelect(child),
                    size: 24,
                    labelElement: label?.outerHTML,
                    inputElement: child?.outerHTML,
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